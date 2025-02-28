import { BaseHealthProvider } from '../../types/provider';
import type { HealthMetrics, RawHealthData, RawHealthMetric, NormalizedMetric } from '../../types/metrics';
import { METRIC_UNITS } from '../../types/metrics';
import { DateUtils } from '../../../../utils/DateUtils';
import type { PermissionState, PermissionStatus } from '../../types/permissions';
import { HealthProviderPermissionError } from '../../types/errors';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../../../../services/supabaseClient';
import { logger, LogCategory } from '@/src/utils/logger';

const STORAGE_KEY = {
  ACCESS_TOKEN: 'fitbit_access_token',
  REFRESH_TOKEN: 'fitbit_refresh_token',
  TOKEN_EXPIRY: 'fitbit_token_expiry',
  LAST_SYNC: 'fitbit_last_sync'
};

export class FitbitHealthProvider extends BaseHealthProvider {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private tokenRefreshInProgress: boolean = false;
  private tokenRefreshPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    try {
      logger.info(LogCategory.Health, '[FitbitHealthProvider] Initializing...');
      
      // Load stored tokens
      this.accessToken = await SecureStore.getItemAsync(STORAGE_KEY.ACCESS_TOKEN);
      this.refreshToken = await SecureStore.getItemAsync(STORAGE_KEY.REFRESH_TOKEN);
      const expiryStr = await SecureStore.getItemAsync(STORAGE_KEY.TOKEN_EXPIRY);
      this.tokenExpiresAt = expiryStr ? parseInt(expiryStr, 10) : null;

      // Set last sync time from storage
      const lastSyncStr = await SecureStore.getItemAsync(STORAGE_KEY.LAST_SYNC);
      if (lastSyncStr) {
        this.lastSyncTime = new Date(parseInt(lastSyncStr, 10));
      }

      // Check token expiry with 5-minute buffer
      if (this.accessToken && this.tokenExpiresAt && 
          (Date.now() >= this.tokenExpiresAt - 5 * 60 * 1000)) {
        await this.refreshAccessToken();
      }

      if (!this.accessToken) {
        logger.warn(LogCategory.Health, '[FitbitHealthProvider] No access token available');
        throw new Error('Fitbit access token not set. Please authenticate first.');
      }

      this.initialized = true;
      logger.info(LogCategory.Health, '[FitbitHealthProvider] Initialization successful');
    } catch (error) {
      logger.error(LogCategory.Health, '[FitbitHealthProvider] Initialization failed:', (error as Error).message);
      throw new Error(`Failed to initialize Fitbit provider: ${error}`);
    }
  }

  async requestPermissions(): Promise<PermissionStatus> {
    try {
      const clientId = process.env.EXPO_PUBLIC_FITBIT_CLIENT_ID!;
      const redirectUri = 'mylera://auth/callback';
      const authUrl = process.env.EXPO_PUBLIC_FITBIT_AUTH_URL!;

      // Configure Auth Request
      const discovery = {
        authorizationEndpoint: authUrl,
        tokenEndpoint: process.env.EXPO_PUBLIC_FITBIT_TOKEN_URL!,
      };

      const request = new AuthSession.AuthRequest({
        clientId,
        scopes: ['activity', 'heartrate', 'profile', 'sleep', 'weight'],
        redirectUri,
        usePKCE: true,
      });

      const result = await request.promptAsync(discovery);
      
      if (result.type === 'success' && result.params.code) {
        // Exchange code for token using Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('fitbit-token-exchange', {
          body: {
            code: result.params.code,
            redirectUri,
            codeVerifier: request.codeVerifier,
          },
        });

        if (error) throw error;

        // Store tokens securely
        await SecureStore.setItemAsync(STORAGE_KEY.ACCESS_TOKEN, data.access_token);
        await SecureStore.setItemAsync(STORAGE_KEY.REFRESH_TOKEN, data.refresh_token);
        await SecureStore.setItemAsync(
          STORAGE_KEY.TOKEN_EXPIRY,
          (Date.now() + data.expires_in * 1000).toString()
        );

        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

        if (this.permissionManager) {
          await this.permissionManager.updatePermissionState('granted');
        }
        return 'granted';
      }

      throw new Error('OAuth flow failed or was cancelled');
    } catch (error) {
      if (this.permissionManager) {
        await this.permissionManager.handlePermissionError('Fitbit', error);
      }
      return 'denied';
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Prevent multiple simultaneous refreshes
    if (this.tokenRefreshInProgress) {
      logger.info(LogCategory.Health, '[FitbitHealthProvider] Token refresh already in progress');
      if (this.tokenRefreshPromise) {
        return this.tokenRefreshPromise;
      }
    }

    this.tokenRefreshInProgress = true;
    this.tokenRefreshPromise = (async () => {
      try {
        logger.info(LogCategory.Health, '[FitbitHealthProvider] Refreshing access token');
        
        // Use retry mechanism for token refresh
        const { data, error } = await this.retryOperation(
          () => supabase.functions.invoke('fitbit-token-refresh', {
            body: { refresh_token: this.refreshToken },
          }),
          3,  // 3 retries
          2000  // 2 second initial delay
        );

        if (error) throw error;

        // Store new tokens
        await SecureStore.setItemAsync(STORAGE_KEY.ACCESS_TOKEN, data.access_token);
        await SecureStore.setItemAsync(STORAGE_KEY.REFRESH_TOKEN, data.refresh_token);
        await SecureStore.setItemAsync(
          STORAGE_KEY.TOKEN_EXPIRY,
          (Date.now() + data.expires_in * 1000).toString()
        );

        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
        
        logger.info(LogCategory.Health, '[FitbitHealthProvider] Token refreshed successfully');
      } catch (error) {
        logger.error(LogCategory.Health, '[FitbitHealthProvider] Token refresh failed:', (error as Error).message);
        throw new Error(`Failed to refresh token: ${error}`);
      } finally {
        this.tokenRefreshInProgress = false;
        this.tokenRefreshPromise = null;
      }
    })();

    return this.tokenRefreshPromise;
  }

  /**
   * checkPermissionsStatus
   *
   * Returns a cached permission state if available, or checks if the access token exists.
   */
  async checkPermissionsStatus(): Promise<PermissionState> {
    if (this.permissionManager) {
      const cached = await this.permissionManager.getPermissionState();
      if (cached) {
        return cached;
      }
    }
    const status: PermissionStatus = this.accessToken ? 'granted' : 'not_determined';
    const state: PermissionState = { status, lastChecked: Date.now() };
    if (this.permissionManager) {
      await this.permissionManager.updatePermissionState(status);
    }
    return state;
  }

  /**
   * Helper: fetchFromFitbit
   *
   * Makes a GET request to the specified Fitbit URL with the Bearer token.
   * Includes automatic token refresh if needed.
   */
  private async fetchFromFitbit(url: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No Fitbit access token available');
    }
    
    // Check if token needs refresh before making request
    if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt - 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    // Use retry mechanism for API calls
    return this.retryOperation(async () => {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });
      
      if (response.status === 401) {
        // Token expired during request, refresh and retry once
        logger.info(LogCategory.Health, '[FitbitHealthProvider] Token expired during request, refreshing');
        await this.refreshAccessToken();
        
        // Retry with new token
        const retryResponse = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Fitbit API error: ${retryResponse.status}`);
        }
        return retryResponse.json();
      }
      
      if (!response.ok) {
        throw new Error(`Fitbit API error: ${response.status}`);
      }
      
      return response.json();
    });
  }

  /**
   * fetchRawMetrics
   *
   * For simplicity, this implementation assumes that the startDate and endDate
   * fall on the same day. Fitbit’s daily endpoints are used to fetch raw metrics.
   */
  async fetchRawMetrics(
    startDate: Date,
    endDate: Date,
    types: string[]
  ): Promise<RawHealthData> {
    const permissionState = await this.checkPermissionsStatus();
    if (permissionState.status !== 'granted') {
      throw new HealthProviderPermissionError('Fitbit', 'Permission not granted for Fitbit data access');
    }
    await this.ensureInitialized();

    // Fitbit endpoints are typically date-based; we assume both dates are the same.
    const dateStr = startDate.toISOString().split('T')[0];
    const rawData: RawHealthData = {};

    await Promise.all(
      types.map(async (type) => {
        switch (type) {
          case 'steps':
            rawData.steps = await this.fetchStepsRaw(dateStr);
            break;
          case 'distance':
            rawData.distance = await this.fetchDistanceRaw(dateStr);
            break;
          case 'calories':
            rawData.calories = await this.fetchCaloriesRaw(dateStr);
            break;
          case 'heart_rate':
            rawData.heart_rate = await this.fetchHeartRateRaw(dateStr);
            break;
          case 'basal_calories':
            rawData.basal_calories = await this.fetchBasalCaloriesRaw(dateStr);
            break;
          case 'flights_climbed':
            rawData.flights_climbed = await this.fetchFlightsClimbedRaw(dateStr);
            break;
          case 'exercise':
            rawData.exercise = await this.fetchExerciseRaw(dateStr);
            break;
        }
      })
    );

    return rawData;
  }

  // ----- Below are helper methods to fetch each metric type via Fitbit API -----

  private async fetchStepsRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // Endpoint: /activities/steps/date/{date}/1d.json
    const url = `https://api.fitbit.com/1/user/-/activities/steps/date/${dateStr}/1d.json`;
    const data = await this.fetchFromFitbit(url);
    if (data && data['activities-steps'] && data['activities-steps'].length > 0) {
      return data['activities-steps'].map((item: any) => ({
        startDate: `${item.dateTime}T00:00:00.000Z`,
        endDate: `${item.dateTime}T23:59:59.999Z`,
        value: Number(item.value),
        unit: 'count',
        sourceBundle: 'com.fitbit.api'
      }));
    }
    return [];
  }

  private async fetchDistanceRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // Endpoint: /activities/distance/date/{date}/1d.json
    const url = `https://api.fitbit.com/1/user/-/activities/distance/date/${dateStr}/1d.json`;
    const data = await this.fetchFromFitbit(url);
    if (data && data['activities-distance'] && data['activities-distance'].length > 0) {
      return data['activities-distance'].map((item: any) => ({
        startDate: `${item.dateTime}T00:00:00.000Z`,
        endDate: `${item.dateTime}T23:59:59.999Z`,
        value: Number(item.value),
        unit: METRIC_UNITS.DISTANCE,
        sourceBundle: 'com.fitbit.api'
      }));
    }
    return [];
  }

  private async fetchCaloriesRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // Endpoint: /activities/calories/date/{date}/1d.json
    const url = `https://api.fitbit.com/1/user/-/activities/calories/date/${dateStr}/1d.json`;
    const data = await this.fetchFromFitbit(url);
    if (data && data['activities-calories'] && data['activities-calories'].length > 0) {
      return data['activities-calories'].map((item: any) => ({
        startDate: `${item.dateTime}T00:00:00.000Z`,
        endDate: `${item.dateTime}T23:59:59.999Z`,
        value: Number(item.value),
        unit: METRIC_UNITS.CALORIES,
        sourceBundle: 'com.fitbit.api'
      }));
    }
    return [];
  }

  private async fetchHeartRateRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // Endpoint: /activities/heart/date/{date}/1d.json
    const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${dateStr}/1d.json`;
    const data = await this.fetchFromFitbit(url);
    if (data && data['activities-heart'] && data['activities-heart'].length > 0) {
      return data['activities-heart'].map((item: any) => ({
        startDate: `${item.dateTime}T00:00:00.000Z`,
        endDate: `${item.dateTime}T23:59:59.999Z`,
        // Here we use restingHeartRate if available; otherwise default to 0.
        value: item.value.restingHeartRate ? Number(item.value.restingHeartRate) : 0,
        unit: METRIC_UNITS.HEART_RATE,
        sourceBundle: 'com.fitbit.api'
      }));
    }
    return [];
  }

  private async fetchBasalCaloriesRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // Fitbit does not provide a direct endpoint for basal calories.
    // Return a placeholder (zero value) for now.
    return [{
      startDate: `${dateStr}T00:00:00.000Z`,
      endDate: `${dateStr}T23:59:59.999Z`,
      value: 0,
      unit: METRIC_UNITS.CALORIES,
      sourceBundle: 'com.fitbit.api'
    }];
  }

  private async fetchFlightsClimbedRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // There is no direct Fitbit endpoint for flights climbed.
    // Return a placeholder (zero value) for now.
    return [{
      startDate: `${dateStr}T00:00:00.000Z`,
      endDate: `${dateStr}T23:59:59.999Z`,
      value: 0,
      unit: METRIC_UNITS.COUNT,
      sourceBundle: 'com.fitbit.api'
    }];
  }

  private async fetchExerciseRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // For this example, we assume no dedicated exercise endpoint.
    // You might consider using "active minutes" or another metric.
    return [{
      startDate: `${dateStr}T00:00:00.000Z`,
      endDate: `${dateStr}T23:59:59.999Z`,
      value: 0,
      unit: METRIC_UNITS.EXERCISE,
      sourceBundle: 'com.fitbit.api'
    }];
  }

  /**
   * normalizeMetrics
   *
   * Converts raw Fitbit data into the standard NormalizedMetric format.
   */
  normalizeMetrics(rawData: RawHealthData, type: string): NormalizedMetric[] {
    const metrics: NormalizedMetric[] = [];
    switch (type) {
      case 'steps':
        if (rawData.steps) {
          metrics.push(...rawData.steps.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.STEPS,
            type: 'steps'
          } as NormalizedMetric)));
        }
        break;
      case 'distance':
        if (rawData.distance) {
          metrics.push(...rawData.distance.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.DISTANCE,
            type: 'distance'
          } as NormalizedMetric)));
        }
        break;
      case 'calories':
        if (rawData.calories) {
          metrics.push(...rawData.calories.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.CALORIES,
            type: 'calories'
          } as NormalizedMetric)));
        }
        break;
      case 'heart_rate':
        if (rawData.heart_rate) {
          metrics.push(...rawData.heart_rate.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.HEART_RATE,
            type: 'heart_rate'
          } as NormalizedMetric)));
        }
        break;
      case 'basal_calories':
        if (rawData.basal_calories) {
          metrics.push(...rawData.basal_calories.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.CALORIES,
            type: 'basal_calories'
          } as NormalizedMetric)));
        }
        break;
      case 'flights_climbed':
        if (rawData.flights_climbed) {
          metrics.push(...rawData.flights_climbed.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.COUNT,
            type: 'flights_climbed'
          } as NormalizedMetric)));
        }
        break;
      case 'exercise':
        if (rawData.exercise) {
          metrics.push(...rawData.exercise.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.EXERCISE,
            type: 'exercise'
          } as NormalizedMetric)));
        }
        break;
    }
    return metrics;
  }

  /**
   * getMetrics
   *
   * Aggregates the normalized metrics into a HealthMetrics object.
   */
  async getMetrics(): Promise<HealthMetrics> {
    const now = new Date();
    const startOfDay = DateUtils.getStartOfDay(now);
    const rawData = await this.fetchRawMetrics(
      startOfDay,
      now,
      ['steps', 'distance', 'calories', 'heart_rate', 'basal_calories', 'flights_climbed', 'exercise']
    );

    const steps = this.aggregateMetric(this.normalizeMetrics(rawData, 'steps'));
    const distance = this.aggregateMetric(this.normalizeMetrics(rawData, 'distance'));
    const calories = this.aggregateMetric(this.normalizeMetrics(rawData, 'calories'));
    const heart_rate = this.aggregateMetric(this.normalizeMetrics(rawData, 'heart_rate'));
    const basal_calories = this.aggregateMetric(this.normalizeMetrics(rawData, 'basal_calories'));
    const flights_climbed = this.aggregateMetric(this.normalizeMetrics(rawData, 'flights_climbed'));
    const exercise = this.aggregateMetric(this.normalizeMetrics(rawData, 'exercise'));

    return {
      id: '',
      user_id: '',
      date: now.toISOString().split('T')[0],
      steps,
      distance,
      calories,
      heart_rate,
      basal_calories,
      flights_climbed,
      exercise,
      daily_score: 0,
      weekly_score: null,
      streak_days: null,
      last_updated: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }

  /**
   * aggregateMetric
   *
   * A simple aggregation (summing) of normalized metric values.
   */
  private aggregateMetric(metrics: NormalizedMetric[]): number {
    return metrics.reduce((sum, metric) => sum + metric.value, 0);
  }

  /**
   * setAccessToken
   *
   * Sets the Fitbit access token; this method should be called after a successful OAuth flow.
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  // Update the setLastSyncTime method to store in SecureStore
  async setLastSyncTime(date: Date): Promise<void> {
    await super.setLastSyncTime(date);
    await SecureStore.setItemAsync(STORAGE_KEY.LAST_SYNC, date.getTime().toString());
  }
}
