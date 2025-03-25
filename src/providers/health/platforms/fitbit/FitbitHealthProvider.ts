import { BaseHealthProvider } from '../../types/BaseHealthProvider';
import type { HealthMetrics, RawHealthData, NormalizedMetric } from '../../types/metrics';
import { DateUtils } from '../../../../utils/DateUtils';
import type { PermissionState, PermissionStatus } from '../../types/permissions';
import { HealthProviderPermissionError } from '../../types/errors';
import { logger, LogCategory } from '@/src/utils/logger';
import { MetricType } from '@/src/types/metrics';
import * as SecureStore from 'expo-secure-store';
import { generateDayRange, STORAGE_KEYS } from './utils';
import { initializeFitbitProvider, refreshFitbitToken } from './initialization';
import { requestFitbitPermissions, checkFitbitPermissions } from './permissions';
import {
  fetchStepsWithDailyAggregation,
  fetchDistanceWithDailyAggregation,
  fetchCaloriesWithDailyAggregation,
  fetchHeartRateWithDailyAggregation,
  fetchBasalCaloriesWithDailyAggregation,
  fetchFlightsClimbedWithDailyAggregation,
  fetchExerciseWithDailyAggregation
} from './metricFetchers';
import { FitbitProviderState } from './types';

export class FitbitHealthProvider extends BaseHealthProvider {
  private state: FitbitProviderState = {
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    tokenRefreshInProgress: false,
    tokenRefreshPromise: null,
    initialized: false,
    lastSyncTime: null
  };

  async initialize(): Promise<void> {
    try {
      this.state = await initializeFitbitProvider();
      this.initialized = true;
    } catch (error) {
      logger.error(LogCategory.Health, '[FitbitHealthProvider] Initialization failed:', (error as Error).message);
      throw error;
    }
  }

  async requestPermissions(): Promise<PermissionStatus> {
    const status = await requestFitbitPermissions();
    const state: PermissionState = { status, lastChecked: Date.now() };
    
    if (this.permissionManager) {
      await this.permissionManager.updatePermissionState(status);
    }
    
    return status;
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    if (this.permissionManager) {
      const cached = await this.permissionManager.getPermissionState();
      if (cached) {
        return cached;
      }
    }

    const status = await checkFitbitPermissions();
    const state: PermissionState = { status, lastChecked: Date.now() };
    
    if (this.permissionManager) {
      await this.permissionManager.updatePermissionState(status);
    }
    
    return state;
  }

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

    // Check if token needs refresh
    if (this.state.tokenExpiresAt && Date.now() >= this.state.tokenExpiresAt - 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    const rawData: RawHealthData = {};

    await Promise.all(
      types.map(async (type) => {
        try {
          switch (type) {
            case 'steps':
              rawData.steps = await fetchStepsWithDailyAggregation(
                this.state.accessToken!,
                startDate,
                endDate
              );
              break;
            case 'distance':
              rawData.distance = await fetchDistanceWithDailyAggregation(
                this.state.accessToken!,
                startDate,
                endDate
              );
              break;
            case 'calories':
              rawData.calories = await fetchCaloriesWithDailyAggregation(
                this.state.accessToken!,
                startDate,
                endDate
              );
              break;
            case 'heart_rate':
              rawData.heart_rate = await fetchHeartRateWithDailyAggregation(
                this.state.accessToken!,
                startDate,
                endDate
              );
              break;
            case 'basal_calories':
              rawData.basal_calories = await fetchBasalCaloriesWithDailyAggregation(
                this.state.accessToken!,
                startDate,
                endDate
              );
              break;
            case 'flights_climbed':
              rawData.flights_climbed = await fetchFlightsClimbedWithDailyAggregation(
                this.state.accessToken!,
                startDate,
                endDate
              );
              break;
            case 'exercise':
              rawData.exercise = await fetchExerciseWithDailyAggregation(
                this.state.accessToken!,
                startDate,
                endDate
              );
              break;
          }
        } catch (error) {
          logger.error(LogCategory.Health, `[FitbitHealthProvider] Error fetching ${type} metrics:`, (error as Error).message);
        }
      })
    );

    // Fill in any missing days
    this.fillMissingDays(rawData, startDate, endDate);

    return rawData;
  }

  private fillMissingDays(rawData: RawHealthData, startDate: Date, endDate: Date): void {
    const days = generateDayRange(startDate, endDate);
    Object.keys(rawData).forEach(metricType => {
      const metrics = rawData[metricType as keyof RawHealthData];
      if (!metrics) return;
      
      const existingDates = new Set(metrics.map(m => m.startDate.split('T')[0]));
      days.forEach((day: string) => {
        if (!existingDates.has(day)) {
          metrics.push({
            startDate: `${day}T00:00:00.000Z`,
            endDate: `${day}T23:59:59.999Z`,
            value: 0,
            unit: metrics[0]?.unit || 'count',
            sourceBundle: 'com.fitbit.api'
          });
        }
      });
    });
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.state.refreshToken) {
      throw new Error('No refresh token available');
    }

    if (this.state.tokenRefreshInProgress) {
      if (this.state.tokenRefreshPromise) {
        return this.state.tokenRefreshPromise;
      }
    }

    this.state.tokenRefreshInProgress = true;
    this.state.tokenRefreshPromise = (async () => {
      try {
        await refreshFitbitToken(this.state.refreshToken);
      } finally {
        this.state.tokenRefreshInProgress = false;
        this.state.tokenRefreshPromise = null;
      }
    })();

    return this.state.tokenRefreshPromise;
  }

  normalizeMetrics(rawData: RawHealthData, type: MetricType): NormalizedMetric[] {
    return super.normalizeMetrics(rawData, type);
  }

  async getMetrics(): Promise<HealthMetrics> {
    try {
      const now = new Date();
      const startOfDay = DateUtils.getStartOfDay(now);
      
      logger.info(LogCategory.Health, '[FitbitHealthProvider] Fetching metrics for time window:', 
        startOfDay.toISOString() + ' to ' + now.toISOString()
      );
      
      return await this.batchFetchHealthMetrics(
        startOfDay,
        now,
        ['steps', 'distance', 'calories', 'heart_rate', 'basal_calories', 'flights_climbed', 'exercise']
      );
    } catch (error) {
      this.handleProviderError('fetching metrics', error);
    }
  }

  async setLastSyncTime(date: Date): Promise<void> {
    await super.setLastSyncTime(date);
    await SecureStore.setItemAsync(STORAGE_KEYS.LAST_SYNC, date.getTime().toString());
    this.state.lastSyncTime = date;
  }
}
