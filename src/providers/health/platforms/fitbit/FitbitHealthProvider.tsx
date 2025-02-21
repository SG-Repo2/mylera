import { BaseHealthProvider } from '../../types/provider';
import type { HealthMetrics, RawHealthData, RawHealthMetric, NormalizedMetric } from '../../types/metrics';
import { METRIC_UNITS } from '../../types/metrics';
import { DateUtils } from '../../../../utils/DateUtils';
import type { PermissionState, PermissionStatus } from '../../types/permissions';
import { HealthProviderPermissionError } from '../../types/errors';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../../../../services/supabaseClient';
import { callWithTimeout, DEFAULT_TIMEOUTS } from '../../../../utils/asyncUtils';

const STORAGE_KEY = {
  ACCESS_TOKEN: 'fitbit_access_token',
  REFRESH_TOKEN: 'fitbit_refresh_token',
  TOKEN_EXPIRY: 'fitbit_token_expiry'
};

export class FitbitHealthProvider extends BaseHealthProvider {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  protected async performInitialization(): Promise<void> {
    await callWithTimeout(
      this.loadAndVerifyTokens(),
      DEFAULT_TIMEOUTS.INITIALIZATION,
      'Token verification timed out'
    );
    
    await this.initializePermissionsAndVerify();
    await this.verifyApiAccess();
  }

  private async loadAndVerifyTokens(): Promise<void> {
    if (!this.userId) {
      throw new Error('Cannot initialize provider without userId');
    }

    const [accessToken, refreshToken, expiryStr] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEY.ACCESS_TOKEN),
      SecureStore.getItemAsync(STORAGE_KEY.REFRESH_TOKEN),
      SecureStore.getItemAsync(STORAGE_KEY.TOKEN_EXPIRY)
    ]);

    if (!accessToken || !refreshToken) {
      throw new Error('Missing Fitbit tokens. Authentication required.');
    }

    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiresAt = expiryStr ? parseInt(expiryStr, 10) : null;

    if (this.tokenExpiresAt && Date.now() >= (this.tokenExpiresAt - 300000)) {
      await this.refreshAccessToken();
    }
  }

  private async verifyApiAccess(): Promise<void> {
    try {
      await callWithTimeout(
        this.fetchFromFitbit('https://api.fitbit.com/1/user/-/profile.json'),
        DEFAULT_TIMEOUTS.API_CALL,
        'API access verification timed out'
      );
    } catch (error) {
      throw new Error(`Token validation failed: ${error}`);
    }
  }

  private async initializePermissionsAndVerify(): Promise<void> {
    await this.initializePermissions(this.userId!);
    
    const permissionManager = this.getPermissionManager();
    if (!permissionManager) {
      throw new Error('Permission manager initialization failed');
    }
    
    const permissionState = await permissionManager.getPermissionState();
    if (!permissionState) {
      throw new Error('Permission state not available after initialization');
    }
    
    if (!(permissionState.status === 'granted' || permissionState.status === 'not_determined')) {
      throw new Error(`Invalid permission state: ${permissionState.status}`);
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
        await Promise.all([
          SecureStore.setItemAsync(STORAGE_KEY.ACCESS_TOKEN, data.access_token),
          SecureStore.setItemAsync(STORAGE_KEY.REFRESH_TOKEN, data.refresh_token),
          SecureStore.setItemAsync(
            STORAGE_KEY.TOKEN_EXPIRY,
            (Date.now() + data.expires_in * 1000).toString()
          )
        ]);

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

  private async refreshTokenIfNeeded(): Promise<void> {
    if (!this.tokenExpiresAt) {
      throw new Error('Token expiration time not set');
    }

    // Check if token will expire in next 5 minutes
    if (Date.now() >= (this.tokenExpiresAt - 5 * 60 * 1000)) {
      const maxRetries = 3;
      const baseDelay = 1000; // 1 second

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await this.refreshAccessToken();
          return;
        } catch (error) {
          if (attempt === maxRetries - 1) {
            throw new Error(`Token refresh failed after ${maxRetries} attempts: ${error}`);
          }
          // Exponential backoff
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          console.log(`[FitbitHealthProvider] Retrying token refresh, attempt ${attempt + 1}/${maxRetries}`);
        }
      }
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const { data, error } = await supabase.functions.invoke('fitbit-token-refresh', {
        body: { refresh_token: this.refreshToken },
      });

      if (error) throw error;

      // Store new tokens
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEY.ACCESS_TOKEN, data.access_token),
        SecureStore.setItemAsync(STORAGE_KEY.REFRESH_TOKEN, data.refresh_token),
        SecureStore.setItemAsync(
          STORAGE_KEY.TOKEN_EXPIRY,
          (Date.now() + data.expires_in * 1000).toString()
        )
      ]);

      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

      console.log('[FitbitHealthProvider] Successfully refreshed access token');
    } catch (error) {
      console.error('[FitbitHealthProvider] Failed to refresh token:', error);
      throw new Error(`Failed to refresh token: ${error}`);
    }
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    if (this.permissionManager) {
      const cached = await this.permissionManager.getPermissionState();
      if (cached) {
        // If we have a provisional state that's ready for upgrade, clear it
        if (cached.status === 'provisional') {
          const timeSinceLastCheck = Date.now() - cached.lastChecked;
          if (timeSinceLastCheck >= 5 * 60 * 1000) { // 5 minutes
            await this.permissionManager.clearCache();
            return { status: 'not_determined', lastChecked: Date.now() };
          }
        }
        return cached;
      }
    }

    // Determine current status based on token and its validity
    let status: PermissionStatus;
    if (!this.accessToken) {
      status = 'not_determined';
    } else {
      try {
        // Test token validity with a lightweight API call
        await this.fetchFromFitbit('https://api.fitbit.com/1/user/-/profile.json');
        status = 'granted';
      } catch (error) {
        // If token is invalid but exists, consider it provisional
        status = 'provisional';
        console.warn('[FitbitHealthProvider] Token validation failed, marking as provisional:', error);
      }
    }

    const state: PermissionState = { status, lastChecked: Date.now() };
    if (this.permissionManager) {
      await this.permissionManager.updatePermissionState(status);
    }
    return state;
  }

  async handlePermissionDenial(): Promise<void> {
    console.log('[FitbitHealthProvider] Handling permission denial');
    
    try {
      // Clear stored tokens
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEY.ACCESS_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEY.REFRESH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEY.TOKEN_EXPIRY)
      ]);

      // Reset instance variables
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiresAt = null;

      // Update permission state and clear cache
      if (this.permissionManager) {
        await this.permissionManager.handlePermissionDenial('Fitbit');
      }

      console.log('[FitbitHealthProvider] Permission denial cleanup completed');
    } catch (error) {
      console.error('[FitbitHealthProvider] Error during permission denial cleanup:', error);
      throw error;
    }
  }

  private async fetchFromFitbit(url: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No Fitbit access token available');
    }
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Fitbit API error: ${response.status}`);
    }
    return response.json();
  }

  async fetchRawMetrics(
    startDate: Date,
    endDate: Date,
    types: string[]
  ): Promise<RawHealthData> {
    // Ensure initialization and permissions are complete
    await this.ensureInitialized();

    const permissionManager = this.getPermissionManager();
    if (!permissionManager) {
      console.error('[FitbitHealthProvider] Permission manager not available for metrics fetch');
      throw new Error('Permission manager not initialized');
    }

    // Verify current permission state with retry logic
    let permissionState;
    const maxRetries = 3;
    const retryDelay = 1000;

    for (let i = 0; i < maxRetries; i++) {
      permissionState = await permissionManager.getPermissionState();
      if (permissionState && permissionState.status === 'granted') {
        break;
      }
      if (i < maxRetries - 1) {
        console.log(`[FitbitHealthProvider] Waiting for permissions, attempt ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
      }
    }

    if (!permissionState || permissionState.status !== 'granted') {
      throw new HealthProviderPermissionError('Fitbit', 'Permission not granted for Fitbit data access');
    }

    // Check if token needs refresh before fetching metrics
    if (this.tokenExpiresAt && Date.now() >= (this.tokenExpiresAt - 300000)) {
      await this.refreshAccessToken();
    }

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

  private async fetchStepsRaw(dateStr: string): Promise<RawHealthMetric[]> {
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
    const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${dateStr}/1d.json`;
    const data = await this.fetchFromFitbit(url);
    if (data && data['activities-heart'] && data['activities-heart'].length > 0) {
      return data['activities-heart'].map((item: any) => ({
        startDate: `${item.dateTime}T00:00:00.000Z`,
        endDate: `${item.dateTime}T23:59:59.999Z`,
        value: item.value.restingHeartRate ? Number(item.value.restingHeartRate) : 0,
        unit: METRIC_UNITS.HEART_RATE,
        sourceBundle: 'com.fitbit.api'
      }));
    }
    return [];
  }

  private async fetchBasalCaloriesRaw(dateStr: string): Promise<RawHealthMetric[]> {
    return [{
      startDate: `${dateStr}T00:00:00.000Z`,
      endDate: `${dateStr}T23:59:59.999Z`,
      value: 0,
      unit: METRIC_UNITS.CALORIES,
      sourceBundle: 'com.fitbit.api'
    }];
  }

  private async fetchFlightsClimbedRaw(dateStr: string): Promise<RawHealthMetric[]> {
    return [{
      startDate: `${dateStr}T00:00:00.000Z`,
      endDate: `${dateStr}T23:59:59.999Z`,
      value: 0,
      unit: METRIC_UNITS.COUNT,
      sourceBundle: 'com.fitbit.api'
    }];
  }

  private async fetchExerciseRaw(dateStr: string): Promise<RawHealthMetric[]> {
    return [{
      startDate: `${dateStr}T00:00:00.000Z`,
      endDate: `${dateStr}T23:59:59.999Z`,
      value: 0,
      unit: METRIC_UNITS.EXERCISE,
      sourceBundle: 'com.fitbit.api'
    }];
  }

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

  async getMetrics(): Promise<HealthMetrics> {
    try {
      await this.refreshTokenIfNeeded();
      
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
    } catch (error) {
      console.error('[FitbitHealthProvider] Failed to get metrics:', error);
      throw new Error(`Failed to get metrics: ${error}`);
    }
  }

  private aggregateMetric(metrics: NormalizedMetric[]): number {
    return metrics.reduce((sum, metric) => sum + metric.value, 0);
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}
