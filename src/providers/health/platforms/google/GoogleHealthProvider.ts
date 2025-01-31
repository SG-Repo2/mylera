import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';
import { mapHealthProviderError } from '../../../../utils/errorUtils';
import { aggregateMetrics, isValidMetricValue } from '../../../../utils/healthMetricUtils';
import { verifyHealthPermission } from '../../../../utils/healthInitUtils';
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
  metadata: {
    id: string;
  };
  energy: {
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
      const errorMessage = mapHealthProviderError(error, 'google');
      console.error('[GoogleHealthProvider]', errorMessage);
      await this.permissionManager.handlePermissionError('HealthConnect', error);
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

      // First verify basic permissions
      const basicPermissionsResult = await Promise.all([
        readRecords('Steps', { timeRangeFilter: testRange }),
        readRecords('Distance', { timeRangeFilter: testRange }),
        readRecords('ActiveCaloriesBurned', { timeRangeFilter: testRange }),
        readRecords('HeartRate', { timeRangeFilter: testRange })
      ]);

      // Separately verify BasalMetabolicRate permission
      try {
        await readRecords('BasalMetabolicRate', { timeRangeFilter: testRange });
      } catch (error) {
        console.warn('[GoogleHealthProvider] BasalMetabolicRate permission verification failed:', error);
        // Don't fail the entire verification for BasalMetabolicRate
        // Other permissions might still be valid
      }

      return basicPermissionsResult.every(result => result !== null);
    } catch (error) {
      console.error('[GoogleHealthProvider] Permission verification failed:', error);
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
            const activeCalories = await readRecords('ActiveCaloriesBurned', { timeRangeFilter });
            rawData.calories = (activeCalories.records as CaloriesRecord[]).map(record => ({
              startDate: record.startTime,
              endDate: record.endTime,
              value: Math.round(record.energy?.inKilocalories || 0),
              unit: 'kcal',
              sourceBundle: 'com.google.android.apps.fitness'
            }));
            break;

          case 'heart_rate':
            const heartRateResponse = await readRecords('HeartRate', { 
              timeRangeFilter,
              ascendingOrder: false,
              pageSize: 100
            });
            
            const validHeartRates = (heartRateResponse.records as HeartRateRecord[])
              .flatMap(record => record.samples
                .filter(sample => 
                  typeof sample.beatsPerMinute === 'number' &&
                  !isNaN(sample.beatsPerMinute) &&
                  sample.beatsPerMinute > 30 &&
                  sample.beatsPerMinute < 220
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

          case 'basal_calories':
            const MAX_BMR_RETRIES = 3;
            const BMR_RETRY_DELAY = 1000;
            let bmrRetries = 0;
            let bmrLastError: Error | null = null;

            while (bmrRetries < MAX_BMR_RETRIES) {
              try {
                // Verify BasalMetabolicRate permission specifically
                const hasBmrPermission = await verifyHealthPermission('BasalMetabolicRate');
                if (!hasBmrPermission) {
                  console.warn('[GoogleHealthProvider] BasalMetabolicRate permission not granted');
                  break;
                }

                const basalCalories = await readRecords('BasalMetabolicRate', { timeRangeFilter });
                const validRecords = (basalCalories.records as unknown as BasalRecord[])
                  .filter(record => record.energy?.inKilocalories && 
                    isValidMetricValue(record.energy.inKilocalories, 'basal_calories'))
                  .map(record => ({
                    startDate: record.startTime,
                    endDate: record.endTime,
                    value: Math.round(record.energy?.inKilocalories || 0),
                    unit: 'kcal',
                    sourceBundle: 'com.google.android.apps.fitness'
                  }));

                if (validRecords.length > 0) {
                  rawData.basal_calories = validRecords;
                  break;
                }

                throw new Error('No valid BasalMetabolicRate records found');
              } catch (error) {
                bmrLastError = error instanceof Error ? error : new Error('Unknown error reading BasalMetabolicRate');
                console.warn(
                  `[GoogleHealthProvider] BasalMetabolicRate read attempt ${bmrRetries + 1}/${MAX_BMR_RETRIES} failed:`,
                  bmrLastError.message
                );
                
                if (bmrRetries < MAX_BMR_RETRIES - 1) {
                  await new Promise(resolve => setTimeout(resolve, BMR_RETRY_DELAY));
                }
                bmrRetries++;
              }
            }

            // If all retries failed or no permission, use fallback
            if (!rawData.basal_calories) {
              console.error(
                '[GoogleHealthProvider] Failed to read BasalMetabolicRate after all retries:',
                bmrLastError?.message
              );
              rawData.basal_calories = [{
                startDate: timeRangeFilter.startTime,
                endDate: timeRangeFilter.endTime,
                value: 0,
                unit: 'kcal',
                sourceBundle: 'com.google.android.apps.fitness'
              }];
            }
            break;

          case 'flights_climbed':
            // Note: Google Health Connect doesn't directly support flights climbed
            // You might want to use a different metric or leave this empty
            rawData.flights_climbed = [{
              startDate: timeRangeFilter.startTime,
              endDate: timeRangeFilter.endTime,
              value: 0,
              unit: 'count',
              sourceBundle: 'com.google.android.apps.fitness'
            }];
            break;

          case 'exercise':
            // Note: You'll need to determine the appropriate Google Health Connect
            // exercise time equivalent here
            rawData.exercise = [{
              startDate: timeRangeFilter.startTime,
              endDate: timeRangeFilter.endTime,
              value: 0,
              unit: 'minutes',
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
      const now = new Date();
      const startOfDay = DateUtils.getStartOfDay(now);
      
      const rawData = await this.fetchRawMetrics(
        startOfDay,
        now,
        ['steps', 'distance', 'calories', 'heart_rate', 'basal_calories', 'flights_climbed', 'exercise']
      );

      // Normalize and aggregate the data
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
        date: DateUtils.getLocalDateString(startOfDay),
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
        updated_at: now.toISOString()
      };
    } catch (error) {
      console.error('[GoogleHealthProvider] Error fetching metrics:', error);
      throw error;
    }
  }

  private aggregateMetric(metrics: NormalizedMetric[]): number | null {
    return aggregateMetrics(metrics);
  }
}
