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
import { MetricType } from '@/src/types/metrics';

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
   * Enhanced to properly fetch and organize data for a date range (like past 7 days)
   * for the bar chart visualization.
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

    // Calculate the date range in the proper format Fitbit API needs
    const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const endDateStr = endDate.toISOString().split('T')[0]; // YYYY-MM-DD

    logger.info(LogCategory.Health, '[FitbitHealthProvider] Fetching data for date range:', undefined, undefined, { 
      startDateStr, 
      endDateStr 
    });

    // Determine number of days in the range
    const daysDiff = Math.round(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    logger.info(LogCategory.Health, '[FitbitHealthProvider] Days in range:', daysDiff.toString());

    const rawData: RawHealthData = {};

    await Promise.all(
      types.map(async (type) => {
        try {
          switch (type) {
            case 'steps':
              rawData.steps = await this.fetchStepsRawRange(startDateStr, endDateStr);
              break;
            case 'distance':
              rawData.distance = await this.fetchDistanceRawRange(startDateStr, endDateStr);
              break;
            case 'calories':
              rawData.calories = await this.fetchCaloriesRawRange(startDateStr, endDateStr);
              break;
            case 'heart_rate':
              rawData.heart_rate = await this.fetchHeartRateRawRange(startDateStr, endDateStr);
              break;
            case 'basal_calories':
              rawData.basal_calories = await this.fetchBasalCaloriesRawRange(startDateStr, endDateStr);
              break;
            case 'flights_climbed':
              rawData.flights_climbed = await this.fetchFlightsClimbedRawRange(startDateStr, endDateStr);
              break;
            case 'exercise':
              rawData.exercise = await this.fetchExerciseRawRange(startDateStr, endDateStr);
              break;
          }
        } catch (error) {
          logger.error(LogCategory.Health, `[FitbitHealthProvider] Error fetching ${type} metrics:`, (error as Error).message);
        }
      })
    );

    // Fill in any missing days to ensure a complete dataset for the bar chart
    this.fillMissingDays(rawData, startDate, endDate);

    return rawData;
  }

  /**
   * Helper method to ensure all days have data, even if no Fitbit records exist
   */
  private fillMissingDays(rawData: RawHealthData, startDate: Date, endDate: Date): void {
    const allDays = this.generateDayRange(startDate, endDate);

    // Process each metric type
    Object.keys(rawData).forEach(metricKey => {
      const metricData = rawData[metricKey as keyof RawHealthData];
      if (!metricData || !Array.isArray(metricData)) return;

      // Get existing days
      const existingDays = new Set(
        metricData.map(item => item.startDate.split('T')[0])
      );

      // Add placeholder entries for missing days using 0 as the default value
      const unit = metricData.length > 0 ? metricData[0].unit : 'count';

      allDays.forEach(day => {
        if (!existingDays.has(day)) {
          metricData.push({
            startDate: `${day}T00:00:00.000Z`,
            endDate: `${day}T23:59:59.999Z`,
            value: 0, // placeholder value of 0 to match RawHealthMetric interface
            unit,
            sourceBundle: 'com.fitbit.api'
          });
        }
      });

      // Sort by date to ensure correct order
      metricData.sort((a, b) => a.startDate.localeCompare(b.startDate));
    });
  }

  /**
   * Generate an array of date strings (YYYY-MM-DD) for all days in a range
   */
  private generateDayRange(startDate: Date, endDate: Date): string[] {
    const days: string[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  // ----- Updated methods to fetch each metric type via Fitbit API for a date range -----

  /**
   * Fetch steps data for a date range
   */
  private async fetchStepsRawRange(startDateStr: string, endDateStr: string): Promise<RawHealthMetric[]> {
    // Endpoint: /activities/steps/date/{baseDate}/{endDate}.json
    const url = `https://api.fitbit.com/1/user/-/activities/steps/date/${startDateStr}/${endDateStr}.json`;
    try {
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
    } catch (error) {
      logger.error(LogCategory.Health, '[FitbitHealthProvider] Error fetching steps range:', (error as Error).message);
      return [];
    }
  }

  /**
   * Fetch distance data for a date range
   */
  private async fetchDistanceRawRange(startDateStr: string, endDateStr: string): Promise<RawHealthMetric[]> {
    // Endpoint: /activities/distance/date/{baseDate}/{endDate}.json
    const url = `https://api.fitbit.com/1/user/-/activities/distance/date/${startDateStr}/${endDateStr}.json`;
    try {
      const data = await this.fetchFromFitbit(url);

      if (data && data['activities-distance'] && data['activities-distance'].length > 0) {
        return data['activities-distance'].map((item: any) => {
          // Fitbit distance is in kilometers, convert to meters for internal consistency
          const distanceKm = Number(item.value);
          const distanceMeters = distanceKm * 1000;

          return {
            startDate: `${item.dateTime}T00:00:00.000Z`,
            endDate: `${item.dateTime}T23:59:59.999Z`,
            value: distanceMeters,
            unit: METRIC_UNITS.DISTANCE,
            sourceBundle: 'com.fitbit.api'
          };
        });
      }

      return [];
    } catch (error) {
      logger.error(LogCategory.Health, '[FitbitHealthProvider] Error fetching distance range:', (error as Error).message);
      return [];
    }
  }

  /**
   * Fetch calories data for a date range
   */
  private async fetchCaloriesRawRange(startDateStr: string, endDateStr: string): Promise<RawHealthMetric[]> {
    // Endpoint: /activities/calories/date/{baseDate}/{endDate}.json
    const url = `https://api.fitbit.com/1/user/-/activities/calories/date/${startDateStr}/${endDateStr}.json`;
    try {
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
    } catch (error) {
      logger.error(LogCategory.Health, '[FitbitHealthProvider] Error fetching calories range:', (error as Error).message);
      return [];
    }
  }

  /**
   * Fetch heart rate data for a date range
   */
  private async fetchHeartRateRawRange(startDateStr: string, endDateStr: string): Promise<RawHealthMetric[]> {
    try {
      // Fetch heart rate data day by day for the range
      const result: RawHealthMetric[] = [];
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);

      for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
        const dateStr = current.toISOString().split('T')[0];

        // Endpoint: /activities/heart/date/{date}/1d.json
        const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${dateStr}/1d.json`;
        try {
          const data = await this.fetchFromFitbit(url);

          if (data && data['activities-heart'] && data['activities-heart'].length > 0) {
            data['activities-heart'].forEach((item: any) => {
              if (item.value.restingHeartRate) {
                result.push({
                  startDate: `${item.dateTime}T00:00:00.000Z`,
                  endDate: `${item.dateTime}T23:59:59.999Z`,
                  value: Number(item.value.restingHeartRate),
                  unit: METRIC_UNITS.HEART_RATE,
                  sourceBundle: 'com.fitbit.api'
                });
              }
            });
          }
        } catch (innerError) {
          logger.warn(LogCategory.Health, `[FitbitHealthProvider] Error fetching heart rate for date ${dateStr}:`, 
            innerError instanceof Error ? innerError.message : 'Unknown error');
          // Continue to next day even if this one fails
        }
      }

      return result;
    } catch (error) {
      logger.error(LogCategory.Health, '[FitbitHealthProvider] Error in heart rate range fetch:', (error as Error).message);
      return [];
    }
  }

  /**
   * Fetch basal calories for a date range (estimated)
   */
  private async fetchBasalCaloriesRawRange(startDateStr: string, endDateStr: string): Promise<RawHealthMetric[]> {
    try {
      // For Fitbit, basal calories can be estimated from the daily summary
      const url = `https://api.fitbit.com/1/user/-/activities/date/${startDateStr}/${endDateStr}.json`;
      const data = await this.fetchFromFitbit(url);

      const result: RawHealthMetric[] = [];
      const dateRange = this.generateDayRange(new Date(startDateStr), new Date(endDateStr));

      for (const date of dateRange) {
        // Look for the date in the response
        const dayData = data.find((day: any) => day.dateTime === date);

        // Extract basal calories (BMR) if available; if not, use 0
        const basalCalories = dayData?.summary?.caloriesBMR;
        result.push({
          startDate: `${date}T00:00:00.000Z`,
          endDate: `${date}T23:59:59.999Z`,
          value: basalCalories ? Number(basalCalories) : 0,
          unit: METRIC_UNITS.CALORIES,
          sourceBundle: 'com.fitbit.api'
        });
      }

      return result;
    } catch (error) {
      logger.warn(LogCategory.Health, '[FitbitHealthProvider] Error or unsupported basal calories:', 
        error instanceof Error ? error.message : 'Unknown error');

      // Generate placeholder entries for the date range
      const result: RawHealthMetric[] = [];
      const dateRange = this.generateDayRange(new Date(startDateStr), new Date(endDateStr));

      for (const date of dateRange) {
        result.push({
          startDate: `${date}T00:00:00.000Z`,
          endDate: `${date}T23:59:59.999Z`,
          value: 0,
          unit: METRIC_UNITS.CALORIES,
          sourceBundle: 'com.fitbit.api'
        });
      }

      return result;
    }
  }

  /**
   * Fetch flights climbed for a date range
   */
  private async fetchFlightsClimbedRawRange(startDateStr: string, endDateStr: string): Promise<RawHealthMetric[]> {
    try {
      // Endpoint: /activities/elevation/date/{baseDate}/{endDate}.json
      const url = `https://api.fitbit.com/1/user/-/activities/elevation/date/${startDateStr}/${endDateStr}.json`;
      const data = await this.fetchFromFitbit(url);

      if (data && data['activities-elevation'] && data['activities-elevation'].length > 0) {
        // Convert elevation to estimated flights (roughly 3 meters per flight)
        return data['activities-elevation'].map((item: any) => {
          const elevationMeters = Number(item.value);
          const estimatedFlights = Math.round(elevationMeters / 3);

          return {
            startDate: `${item.dateTime}T00:00:00.000Z`,
            endDate: `${item.dateTime}T23:59:59.999Z`,
            value: estimatedFlights || 0,  // use 0 if estimatedFlights is falsy
            unit: METRIC_UNITS.COUNT,
            sourceBundle: 'com.fitbit.api'
          };
        });
      }

      // If no data, generate placeholder entries
      const dateRange = this.generateDayRange(new Date(startDateStr), new Date(endDateStr));
      return dateRange.map(date => ({
        startDate: `${date}T00:00:00.000Z`,
        endDate: `${date}T23:59:59.999Z`,
        value: 0,
        unit: METRIC_UNITS.COUNT,
        sourceBundle: 'com.fitbit.api'
      }));
    } catch (error) {
      logger.warn(LogCategory.Health, '[FitbitHealthProvider] Error fetching flights climbed:', 
        error instanceof Error ? error.message : 'Unknown error');

      // Generate placeholder entries for the date range
      const dateRange = this.generateDayRange(new Date(startDateStr), new Date(endDateStr));
      return dateRange.map(date => ({
        startDate: `${date}T00:00:00.000Z`,
        endDate: `${date}T23:59:59.999Z`,
        value: 0,
        unit: METRIC_UNITS.COUNT,
        sourceBundle: 'com.fitbit.api'
      }));
    }
  }

  /**
   * Fetch exercise minutes for a date range
   */
  private async fetchExerciseRawRange(startDateStr: string, endDateStr: string): Promise<RawHealthMetric[]> {
    try {
      // Fetch activities for each day in the range
      const result: RawHealthMetric[] = [];
      const dateRange = this.generateDayRange(new Date(startDateStr), new Date(endDateStr));

      for (const date of dateRange) {
        // Endpoint: /activities/date/{date}.json
        const url = `https://api.fitbit.com/1/user/-/activities/date/${date}.json`;

        try {
          const data = await this.fetchFromFitbit(url);

          // Calculate total exercise minutes from activities
          let totalMinutes = 0;

          if (data && data.activities && Array.isArray(data.activities)) {
            data.activities.forEach((activity: any) => {
              if (activity.activityLevel &&
                  ['moderate', 'vigorous', 'very vigorous'].includes(activity.activityLevel.toLowerCase())) {
                totalMinutes += activity.duration / 60000; // Convert from ms to minutes
              }
            });
          }

          result.push({
            startDate: `${date}T00:00:00.000Z`,
            endDate: `${date}T23:59:59.999Z`,
            value: totalMinutes ? Math.round(totalMinutes) : 0,
            unit: METRIC_UNITS.EXERCISE,
            sourceBundle: 'com.fitbit.api'
          });
        } catch (dayError) {
          logger.warn(LogCategory.Health, `[FitbitHealthProvider] Error fetching exercise for date ${date}:`, 
            dayError instanceof Error ? dayError.message : 'Unknown error');
          result.push({
            startDate: `${date}T00:00:00.000Z`,
            endDate: `${date}T23:59:59.999Z`,
            value: 0,
            unit: METRIC_UNITS.EXERCISE,
            sourceBundle: 'com.fitbit.api'
          });
        }
      }

      return result;
    } catch (error) {
      logger.error(LogCategory.Health, '[FitbitHealthProvider] Error fetching exercise range:', (error as Error).message);
      const dateRange = this.generateDayRange(new Date(startDateStr), new Date(endDateStr));
      return dateRange.map(date => ({
        startDate: `${date}T00:00:00.000Z`,
        endDate: `${date}T23:59:59.999Z`,
        value: 0,
        unit: METRIC_UNITS.EXERCISE,
        sourceBundle: 'com.fitbit.api'
      }));
    }
  }

  /**
   * normalizeMetrics
   *
   * Converts raw Fitbit data into the standard NormalizedMetric format using
   * the standardized implementation from BaseHealthProvider.
   */
  normalizeMetrics(rawData: RawHealthData, type: MetricType): NormalizedMetric[] {
    // Use the standardized implementation from BaseHealthProvider
    return super.normalizeMetrics(rawData, type);
  }

  /**
   * getMetrics
   *
   * Aggregates the normalized metrics into a HealthMetrics object.
   */
  async getMetrics(): Promise<HealthMetrics> {
    try {
      const now = new Date();
      const startOfDay = DateUtils.getStartOfDay(now);
      
      console.log('[FitbitHealthProvider] Fetching metrics for time window:', {
        start: startOfDay.toISOString(),
        end: now.toISOString()
      });
      
      // Use batched fetch for all metrics
      return await this.batchFetchHealthMetrics(
        startOfDay,
        now,
        ['steps', 'distance', 'calories', 'heart_rate', 'basal_calories', 'flights_climbed', 'exercise']
      );
    } catch (error) {
      this.handleProviderError('fetching metrics', error);
    }
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
