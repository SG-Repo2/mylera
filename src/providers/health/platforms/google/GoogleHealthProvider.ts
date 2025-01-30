import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';
import { BaseHealthProvider } from '../../types/provider';
import { 
  HealthMetrics, 
  RawHealthData, 
  NormalizedMetric,
  METRIC_UNITS 
} from '../../types/metrics';
import { MetricType } from '../../../../types/metrics';
import { DateUtils } from '../../../../utils/DateUtils';
import { PermissionState, PermissionStatus } from '../../types/permissions';
import { HealthProviderPermissionError } from '../../types/errors';
import { HEALTH_PERMISSIONS } from './permissions';

interface StepsRecord {
  startTime: string;
  endTime: string;
  count: number;
}

interface DistanceRecord {
  startTime: string;
  endTime: string;
  distance: {
    inMeters: number;
  };
}

interface CaloriesRecord {
  startTime: string;
  endTime: string;
  energy?: {
    inKilocalories: number;
  };
}

interface BasalRecord {
  startTime: string;
  endTime: string;
  energy?: {
    inKilocalories: number;
  };
}

interface HeartRateRecord {
  startTime: string;
  endTime: string;
  samples: Array<{
    beatsPerMinute: number;
  }>;
}

export class GoogleHealthProvider extends BaseHealthProvider {
  private initializationPromise: Promise<void> | null = null;

  private async performInitialization(): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('GoogleHealthProvider can only be used on Android');
    }

    const available = await initialize();
    
    if (!available) {
      throw new Error('Health Connect is not available');
    }

    this.initialized = true;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // Start new initialization
    this.initializationPromise = this.performInitialization();
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  async requestPermissions(): Promise<PermissionStatus> {
    if (!this.permissionManager) {
      throw new Error('Permission manager not initialized');
    }

    try {
      await this.ensureInitialized();

      // Check if permissions are already granted
      const currentState = await this.checkPermissionsStatus();
      if (currentState.status === 'granted') {
        return 'granted';
      }

      // Request permissions through Health Connect
      await requestPermission(HEALTH_PERMISSIONS);
      
      // Verify permissions were granted
      const verificationResult = await this.verifyPermissions();
      const status: PermissionStatus = verificationResult ? 'granted' : 'denied';
      
      await this.permissionManager.updatePermissionState(status);
      return status;
    } catch (error) {
      await this.permissionManager.handlePermissionError(
        'HealthConnect',
        error
      );
      return 'denied';
    }
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    if (!this.permissionManager) {
      throw new Error('Permission manager not initialized');
    }

    // First check cached state
    const cachedState = await this.permissionManager.getPermissionState();
    if (cachedState) {
      return cachedState;
    }

    try {
      if (!this.initialized) {
        const available = await initialize();
        if (!available) {
          const state: PermissionState = {
            status: 'denied',
            lastChecked: Date.now(),
            deniedPermissions: ['HealthConnect']
          };
          await this.permissionManager.updatePermissionState('denied', ['HealthConnect']);
          return state;
        }
      }
      
      const hasPermissions = await this.verifyPermissions();
      const status: PermissionStatus = hasPermissions ? 'granted' : 'not_determined';
      
      const state: PermissionState = {
        status,
        lastChecked: Date.now()
      };

      await this.permissionManager.updatePermissionState(status);
      return state;
    } catch (error) {
      const state: PermissionState = {
        status: 'denied',
        lastChecked: Date.now(),
        deniedPermissions: ['HealthConnect']
      };
      await this.permissionManager.updatePermissionState('denied', ['HealthConnect']);
      return state;
    }
  }

  private async verifyPermissions(): Promise<boolean> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const testRange = {
        operator: 'between' as const,
        startTime: DateUtils.getStartOfDay(yesterday).toISOString(),
        endTime: now.toISOString(),
      };
      
      await Promise.all([
        readRecords('Steps', { timeRangeFilter: testRange }),
        readRecords('Distance', { timeRangeFilter: testRange }),
        readRecords('ActiveCaloriesBurned', { timeRangeFilter: testRange }),
        readRecords('HeartRate', { timeRangeFilter: testRange })
      ]);
      return true;
    } catch (error) {
      return false;
    }
  }

  async handlePermissionDenial(): Promise<void> {
    await super.handlePermissionDenial();
    // Additional platform-specific handling could be added here
  }

  async fetchRawMetrics(
    startDate: Date,
    endDate: Date,
    types: MetricType[]
  ): Promise<RawHealthData> {
    // Check permissions before fetching
    const permissionState = await this.checkPermissionsStatus();
    if (permissionState.status !== 'granted') {
      throw new HealthProviderPermissionError(
        'HealthConnect',
        'Permission not granted for health data access'
      );
    }

    await this.ensureInitialized();

    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };

    const rawData: RawHealthData = {};

    await Promise.all(
      types.map(async (type) => {
        switch (type) {
          case 'steps':
            const stepsResponse = await readRecords('Steps', { timeRangeFilter });
            rawData.steps = (stepsResponse.records as StepsRecord[]).map(record => ({
              startDate: record.startTime,
              endDate: record.endTime,
              value: record.count,
              unit: 'count',
              sourceBundle: 'com.google.android.apps.fitness'
            }));
            break;

          case 'distance':
            const distanceResponse = await readRecords('Distance', { timeRangeFilter });
            rawData.distance = (distanceResponse.records as DistanceRecord[]).map(record => ({
              startDate: record.startTime,
              endDate: record.endTime,
              value: record.distance.inMeters,
              unit: 'meters',
              sourceBundle: 'com.google.android.apps.fitness'
            }));
            break;

          case 'calories':
            const [activeCalories, basalCalories] = await Promise.all([
              readRecords('ActiveCaloriesBurned', { timeRangeFilter }),
              readRecords('BasalMetabolicRate', { timeRangeFilter })
            ]);
            
            const totalCalories = (
              (activeCalories.records as unknown as CaloriesRecord[]).reduce((sum, record) => 
                sum + (record.energy?.inKilocalories || 0), 0) +
              (basalCalories.records as unknown as BasalRecord[]).reduce((sum, record) =>
                sum + (record.energy?.inKilocalories || 0), 0)
            );

            rawData.calories = [{
              startDate: timeRangeFilter.startTime,
              endDate: timeRangeFilter.endTime,
              value: Math.round(totalCalories),
              unit: 'kcal',
              sourceBundle: 'com.google.android.apps.fitness'
            }];
            break;

          case 'heart_rate':
            const heartRateResponse = await readRecords('HeartRate', { 
              timeRangeFilter,
              ascendingOrder: false,
              pageSize: 100 // Use pageSize instead of limit
            });
            
            const validHeartRates = (heartRateResponse.records as HeartRateRecord[])
              .flatMap(record => record.samples
                .filter(sample => 
                  typeof sample.beatsPerMinute === 'number' &&
                  !isNaN(sample.beatsPerMinute) &&
                  sample.beatsPerMinute > 30 && // More realistic minimum heart rate
                  sample.beatsPerMinute < 220 // Maximum realistic heart rate
                )
                .map(sample => ({
                  startDate: record.startTime,
                  endDate: record.endTime,
                  value: Math.round(sample.beatsPerMinute),
                  unit: 'bpm',
                  sourceBundle: 'com.google.android.apps.fitness'
                }))
              );

            rawData.heart_rate = validHeartRates.length > 0 ? validHeartRates : [{
              startDate: timeRangeFilter.startTime,
              endDate: timeRangeFilter.endTime,
              value: 0,
              unit: 'bpm',
              sourceBundle: 'com.google.android.apps.fitness'
            }];
            break;
        }
      })
    );

    return rawData;
  }

  normalizeMetrics(rawData: RawHealthData, type: MetricType): NormalizedMetric[] {
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
    }

    return metrics;
  }

  async getMetrics(): Promise<HealthMetrics> {
    try {
      const now = new Date();
      const startOfDay = DateUtils.getStartOfDay(now);
      
      const rawData = await this.fetchRawMetrics(
        startOfDay,
        now,
        ['steps', 'distance', 'calories', 'heart_rate']
      );

      // Normalize and aggregate the data
      const steps = this.aggregateMetric(this.normalizeMetrics(rawData, 'steps'));
      const distance = this.aggregateMetric(this.normalizeMetrics(rawData, 'distance'));
      const calories = this.aggregateMetric(this.normalizeMetrics(rawData, 'calories'));
      const heart_rate = this.aggregateMetric(this.normalizeMetrics(rawData, 'heart_rate'));

      return {
        id: '',
        user_id: '',
        date: DateUtils.getLocalDateString(startOfDay),
        steps,
        distance,
        calories,
        heart_rate,
        exercise: null,  // To be implemented later
        standing: null,  // To be implemented later
        daily_score: 0,
        weekly_score: null,
        streak_days: null,
        last_updated: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      };
    } catch (error) {
      console.error('[GoogleHealthProvider] Error fetching metrics:', error);
      throw error;
    }
  }

  private aggregateMetric(metrics: NormalizedMetric[]): number | null {
    if (!metrics.length) return null;

    switch (metrics[0].type) {
      case 'heart_rate':
        // Average for heart rate
        return Math.round(
          metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
        );
      default:
        // Sum for other metrics
        return Math.round(
          metrics.reduce((sum, m) => sum + m.value, 0)
        );
    }
  }
}