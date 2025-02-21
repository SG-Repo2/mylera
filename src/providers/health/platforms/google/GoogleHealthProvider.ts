import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';
import { mapHealthProviderError } from '../../../../utils/errorUtils';
import { aggregateMetrics, isValidMetricValue } from '../../../../utils/healthMetricUtils';
import { verifyHealthPermission } from '../../../../utils/healthPermissionUtils';
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
import { 
  HealthProviderPermissionError,
  HealthMetricError
} from '../../types/errors';
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

interface ExerciseRecord {
  startTime: string;
  endTime: string;
}

export class GoogleHealthProvider extends BaseHealthProvider {
  private initializationPromise: Promise<void> | null = null;

  constructor(userId?: string) {
    super();
    this.userId = userId || null;
  }

  async initialize(): Promise<void> {
    console.log('[GoogleHealthProvider] Initialize called. Current state:', {
      initialized: this.initialized,
      initializationInProgress: !!this.initializationPromise
    });

    if (this.initialized) {
      console.log('[GoogleHealthProvider] Already initialized');
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      console.log('[GoogleHealthProvider] Waiting for existing initialization...');
      await this.initializationPromise;
      return;
    }

    // Start new initialization
    console.log('[GoogleHealthProvider] Starting new initialization');
    this.initializationPromise = (async () => {
      try {
        // First initialize the platform
        await this.performInitialization();
        
        // Ensure we have a userId before proceeding
        if (!this.userId) {
          throw new Error('Cannot initialize provider without userId');
        }

        // Initialize and verify permissions
        console.log('[GoogleHealthProvider] Initializing permissions for user:', this.userId);
        await this.initializePermissions(this.userId);
        
        // Explicitly verify permission manager state
        const permissionManager = this.getPermissionManager();
        if (!permissionManager) {
          throw new Error('Permission manager initialization failed');
        }
        
        // Wait for and verify permission state
        const permissionState = await permissionManager.getPermissionState();
        if (!permissionState) {
          throw new Error('Permission state not available after initialization');
        }
        
        console.log('[GoogleHealthProvider] Permission state after initialization:', permissionState);
        
        // Only mark as initialized if permissions are properly set up
        if (permissionState.status === 'granted' || permissionState.status === 'not_determined') {
          this.initialized = true;
          console.log('[GoogleHealthProvider] Initialization completed successfully');
        } else {
          throw new Error(`Invalid permission state: ${permissionState.status}`);
        }
      } catch (error) {
        console.error('[GoogleHealthProvider] Initialization failed:', error);
        this.initialized = false;
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    await this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('GoogleHealthProvider can only be used on Android');
    }

    console.log('[GoogleHealthProvider] Starting platform initialization...');
    
    const available = await initialize();
    console.log('[GoogleHealthProvider] Health Connect availability:', available);
    
    if (!available) {
      throw new Error('Health Connect is not available');
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
    // Ensure initialization and permissions are complete
    await this.ensureInitialized();

    // Double-check permission manager state and wait for any pending initialization
    if (this.initializationPromise) {
      await this.initializationPromise;
    }

    const permissionManager = this.getPermissionManager();
    if (!permissionManager) {
      console.error('[GoogleHealthProvider] Permission manager not available for metrics fetch');
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
        console.log(`[GoogleHealthProvider] Waiting for permissions, attempt ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!permissionState || permissionState.status !== 'granted') {
      console.error('[GoogleHealthProvider] Invalid permission state for metrics fetch:', permissionState);
      throw new Error('Health permissions not granted');
    }

    console.log('[GoogleHealthProvider] Starting metrics fetch with verified permissions');
    
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
            try {
              console.log('[GoogleHealthProvider] Fetching steps records...');
              const stepsResponse = await readRecords('Steps', { timeRangeFilter });
              
              if (!stepsResponse?.records || !Array.isArray(stepsResponse.records)) {
                const error = new HealthMetricError('steps', 'Invalid response format from Health Connect');
                console.error('[GoogleHealthProvider]', error.message, stepsResponse);
                throw error;
              }

              const validRecords = (stepsResponse.records as StepsRecord[])
                .filter(record => {
                  const isValid = typeof record.count === 'number' && 
                                !isNaN(record.count) && 
                                record.count >= 0;
                  if (!isValid) {
                    console.warn('[GoogleHealthProvider] Invalid steps record:', record);
                  }
                  return isValid;
                })
                .map(record => ({
                  startDate: record.startTime,
                  endDate: record.endTime,
                  value: record.count,
                  unit: 'count',
                  sourceBundle: 'com.google.android.apps.fitness'
                }));

              console.log('[GoogleHealthProvider] Processed steps metrics:', {
                validRecordCount: validRecords.length,
                totalSteps: validRecords.reduce((sum, record) => sum + record.value, 0)
              });

              rawData.steps = validRecords;
            } catch (error) {
              console.error('[GoogleHealthProvider] Error processing steps records:', error);
              if (error instanceof HealthMetricError) {
                throw error;
              }
              throw new HealthMetricError('steps', error instanceof Error ? error.message : 'Unknown error');
            }
            break;

          case 'distance':
            try {
              console.log('[GoogleHealthProvider] Fetching distance records...');
              const distanceResponse = await readRecords('Distance', { timeRangeFilter });
              
              // Log detailed response structure
              console.log('[GoogleHealthProvider] Distance response structure:', {
                hasRecords: !!distanceResponse?.records,
                recordCount: distanceResponse?.records?.length,
                firstRecord: distanceResponse?.records?.[0],
                timeRange: timeRangeFilter
              });

              if (!distanceResponse?.records || !Array.isArray(distanceResponse.records)) {
                const error = new HealthMetricError('distance', 'Invalid response format from Health Connect');
                console.error('[GoogleHealthProvider]', error.message, distanceResponse);
                throw error;
              }

              // Validate and map records with detailed logging
              const validRecords = (distanceResponse.records as DistanceRecord[])
                .filter(record => {
                  const isValid = record?.distance?.inMeters != null && 
                                 isValidMetricValue(record.distance.inMeters, 'distance');
                  if (!isValid) {
                    console.warn('[GoogleHealthProvider] Invalid distance record:', record);
                  }
                  return isValid;
                })
                .map(record => ({
                  startDate: record.startTime,
                  endDate: record.endTime,
                  value: record.distance.inMeters,
                  unit: 'meters',
                  sourceBundle: 'com.google.android.apps.fitness'
                }));

              console.log('[GoogleHealthProvider] Processed distance metrics:', {
                validRecordCount: validRecords.length,
                totalDistance: validRecords.reduce((sum, record) => sum + record.value, 0),
                timeWindow: {
                  start: timeRangeFilter.startTime,
                  end: timeRangeFilter.endTime
                }
              });

              rawData.distance = validRecords;
            } catch (error) {
              console.error('[GoogleHealthProvider] Error processing distance records:', error);
              if (error instanceof HealthMetricError) {
                throw error;
              }
              throw new HealthMetricError('distance', error instanceof Error ? error.message : 'Unknown error');
            }
            break;

          case 'calories':
            try {
              console.log('[GoogleHealthProvider] Fetching active calories records...');
              const activeCalories = await readRecords('ActiveCaloriesBurned', { timeRangeFilter });
              console.log('[GoogleHealthProvider] Raw active calories response:', activeCalories);

              if (!activeCalories.records || !Array.isArray(activeCalories.records)) {
                const error = new HealthMetricError('calories', 'Invalid response format from Health Connect');
                console.error('[GoogleHealthProvider]', error.message, activeCalories);
                throw error;
              }

              const validRecords = (activeCalories.records as CaloriesRecord[])
                .filter(record => {
                  const isValid = record.energy?.inKilocalories != null && 
                                !isNaN(record.energy.inKilocalories) &&
                                record.energy.inKilocalories >= 0;
                  if (!isValid) {
                    console.warn('[GoogleHealthProvider] Invalid calories record:', record);
                  }
                  return isValid;
                })
                .map(record => ({
                  startDate: record.startTime,
                  endDate: record.endTime,
                  value: Math.round(record.energy!.inKilocalories),
                  unit: 'kcal',
                  sourceBundle: 'com.google.android.apps.fitness'
                }));

              console.log('[GoogleHealthProvider] Processed calories metrics:', validRecords);
              rawData.calories = validRecords;
            } catch (error) {
              console.error('[GoogleHealthProvider] Error processing calories records:', error);
              if (error instanceof HealthMetricError) {
                throw error;
              }
              throw new HealthMetricError('calories', error instanceof Error ? error.message : 'Unknown error');
            }
            break;

          case 'heart_rate':
            try {
              console.log('[GoogleHealthProvider] Fetching heart rate records...');
              const heartRateResponse = await readRecords('HeartRate', { 
                timeRangeFilter,
                ascendingOrder: false,
                pageSize: 100
              });

              if (!heartRateResponse?.records || !Array.isArray(heartRateResponse.records)) {
                const error = new HealthMetricError('heart_rate', 'Invalid response format from Health Connect');
                console.error('[GoogleHealthProvider]', error.message, heartRateResponse);
                throw error;
              }
              
              const validHeartRates = (heartRateResponse.records as HeartRateRecord[])
                .flatMap(record => {
                  if (!Array.isArray(record.samples)) {
                    console.warn('[GoogleHealthProvider] Invalid heart rate record format:', record);
                    return [];
                  }
                  return record.samples
                    .filter(sample => {
                      const isValid = typeof sample.beatsPerMinute === 'number' &&
                                    !isNaN(sample.beatsPerMinute) &&
                                    sample.beatsPerMinute > 30 &&
                                    sample.beatsPerMinute < 220;
                      if (!isValid) {
                        console.warn('[GoogleHealthProvider] Invalid heart rate sample:', sample);
                      }
                      return isValid;
                    })
                    .map(sample => ({
                      startDate: record.startTime,
                      endDate: record.endTime,
                      value: Math.round(sample.beatsPerMinute),
                      unit: 'bpm',
                      sourceBundle: 'com.google.android.apps.fitness'
                    }));
                });

              console.log('[GoogleHealthProvider] Processed heart rate metrics:', {
                validSampleCount: validHeartRates.length,
                averageHeartRate: validHeartRates.length > 0 
                  ? Math.round(validHeartRates.reduce((sum, record) => sum + record.value, 0) / validHeartRates.length)
                  : 0
              });

              rawData.heart_rate = validHeartRates;
            } catch (error) {
              console.error('[GoogleHealthProvider] Error processing heart rate records:', error);
              if (error instanceof HealthMetricError) {
                throw error;
              }
              throw new HealthMetricError('heart_rate', error instanceof Error ? error.message : 'Unknown error');
            }
            break;

          case 'basal_calories':
            try {
              console.log('[GoogleHealthProvider] Defaulting basal calories to 0');
              rawData.basal_calories = [{
                startDate: timeRangeFilter.startTime,
                endDate: timeRangeFilter.endTime,
                value: 0,
                unit: 'kcal',
                sourceBundle: 'com.google.android.apps.fitness'
              }];
            } catch (error) {
              console.error('[GoogleHealthProvider] Error processing basal calories records:', error);
              if (error instanceof HealthProviderPermissionError || 
                  error instanceof HealthMetricError) {
                throw error;
              }
              throw new HealthMetricError('basal_calories', error instanceof Error ? error.message : 'Unknown error');
            }
            break;

          case 'flights_climbed':
            // Google Health Connect does not support flights climbed metric
            console.warn('[GoogleHealthProvider] Flights climbed metric is not supported by Google Health Connect');
            rawData.flights_climbed = [];
            break;

          case 'exercise':
            try {
              console.log('[GoogleHealthProvider] Fetching exercise records...');
              // Google Health Connect uses ExerciseSession for tracking exercise time
              const exerciseResponse = await readRecords('ExerciseSession', { timeRangeFilter });

              if (!exerciseResponse?.records || !Array.isArray(exerciseResponse.records)) {
                const error = new HealthMetricError('exercise', 'Invalid response format from Health Connect');
                console.error('[GoogleHealthProvider]', error.message, exerciseResponse);
                throw error;
              }

              const validRecords = (exerciseResponse.records as ExerciseRecord[])
                .filter(record => {
                  const duration = new Date(record.endTime).getTime() - new Date(record.startTime).getTime();
                  const durationMinutes = Math.round(duration / (1000 * 60));
                  const isValid = durationMinutes >= 0;
                  if (!isValid) {
                    console.warn('[GoogleHealthProvider] Invalid exercise record:', record);
                  }
                  return isValid;
                })
                .map(record => {
                  const duration = new Date(record.endTime).getTime() - new Date(record.startTime).getTime();
                  return {
                    startDate: record.startTime,
                    endDate: record.endTime,
                    value: Math.round(duration / (1000 * 60)), // Convert to minutes
                    unit: 'minutes',
                    sourceBundle: 'com.google.android.apps.fitness'
                  };
                });

              console.log('[GoogleHealthProvider] Processed exercise metrics:', {
                validRecordCount: validRecords.length,
                totalExerciseMinutes: validRecords.reduce((sum, record) => sum + record.value, 0)
              });

              rawData.exercise = validRecords;
            } catch (error) {
              console.error('[GoogleHealthProvider] Error processing exercise records:', error);
              if (error instanceof HealthMetricError) {
                throw error;
              }
              throw new HealthMetricError('exercise', error instanceof Error ? error.message : 'Unknown error');
            }
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
        user_id: this.userId || '',
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
