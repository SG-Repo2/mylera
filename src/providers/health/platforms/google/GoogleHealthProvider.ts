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
import { HealthProviderPermissionError } from '../../types/errors';
import { 
  HEALTH_PERMISSIONS, 
  PERMISSION_TYPES,
  getAndroidPermission,
  getPermissionDescription,
  formatPermissionError,
  getAllRequiredPermissions,
  getMissingPermissions,
  type PermissionType
} from './permissions';

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
  private permissionVerificationRetries = 3;
  private permissionVerificationDelay = 1000;

  private async performInitialization(): Promise<void> {
    if (Platform.OS !== 'android') {
      const error = new HealthProviderPermissionError(
        'HealthConnect',
        'GoogleHealthProvider can only be used on Android'
      );
      console.error('[GoogleHealthProvider] Platform error:', error.message);
      throw error;
    }

    console.log('[GoogleHealthProvider] Starting initialization...', {
      platform: Platform.OS,
      version: Platform.Version
    });
    
    try {
      console.log('[GoogleHealthProvider] Checking Health Connect availability');
      const available = await initialize();
      console.log('[GoogleHealthProvider] Health Connect availability result:', available);
      
      if (!available) {
        const error = new HealthProviderPermissionError(
          'HealthConnect',
          'Health Connect is not available. Please ensure the Health Connect app is installed and up to date.'
        );
        console.error('[GoogleHealthProvider] Availability check failed:', error.message);
        throw error;
      }

      this.initialized = true;
      console.log('[GoogleHealthProvider] Initialization successful');
    } catch (error) {
      console.error(
        '[GoogleHealthProvider] Initialization failed:',
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error.stack : 'No stack trace'
      );

      // Enhance error context
      let enhancedError: Error;
      if (error instanceof Error) {
        if (error.message.includes('not available')) {
          enhancedError = new HealthProviderPermissionError(
            'HealthConnect',
            'Health Connect is not available. Please check if the app is installed and permissions are granted.'
          );
        } else if (error.message.includes('permission')) {
          enhancedError = new HealthProviderPermissionError(
            'HealthConnect',
            'Health Connect permissions are not granted. Please grant the necessary permissions.'
          );
        } else {
          enhancedError = new HealthProviderPermissionError(
            'HealthConnect',
            `Health Connect initialization failed: ${error.message}`
          );
        }
      } else {
        enhancedError = new HealthProviderPermissionError(
          'HealthConnect',
          'Unknown error during Health Connect initialization'
        );
      }

      // Log additional context
      console.error('[GoogleHealthProvider] Initialization context:', {
        platform: Platform.OS,
        version: Platform.Version,
        error: enhancedError.message,
        originalError: error instanceof Error ? error.message : 'Unknown error'
      });

      throw enhancedError;
    }
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
    this.initializationPromise = this.performInitialization();
    try {
      await this.initializationPromise;
      console.log('[GoogleHealthProvider] Initialization completed successfully');
    } catch (error) {
      console.error('[GoogleHealthProvider] Initialization failed:', error);
      throw error;
    } finally {
      this.initializationPromise = null;
    }
  }

  async requestPermissions(): Promise<PermissionStatus> {
    if (!this.permissionManager) {
      const error = new HealthProviderPermissionError(
        'HealthConnect',
        'Permission manager not initialized'
      );
      console.error('[GoogleHealthProvider] Permission request failed:', error.message);
      throw error;
    }

    try {
      console.log('[GoogleHealthProvider] Starting permission request process');
      await this.ensureInitialized();

      // Check if permissions are already granted
      console.log('[GoogleHealthProvider] Checking current permission state');
      const currentState = await this.checkPermissionsStatus();
      
      if (currentState.status === 'granted') {
        console.log('[GoogleHealthProvider] Permissions already granted');
        return 'granted';
      }

      // Request permissions through Health Connect
      console.log('[GoogleHealthProvider] Requesting permissions:', 
        HEALTH_PERMISSIONS.map(p => ({
          type: p.recordType,
          androidPermission: getAndroidPermission(p.recordType as PermissionType)
        }))
      );
      
      await requestPermission(HEALTH_PERMISSIONS);
      
      // Verify permissions were granted
      console.log('[GoogleHealthProvider] Verifying granted permissions');
      const verificationResult = await this.verifyPermissions();
      const status: PermissionStatus = verificationResult ? 'granted' : 'denied';
      
      if (status === 'denied') {
        const deniedPermissions = await this.getDeniedPermissions();
        console.error('[GoogleHealthProvider] Permission verification failed. Denied permissions:', 
          deniedPermissions.map(type => ({
            type,
            androidPermission: getAndroidPermission(type),
            description: getPermissionDescription(type)
          }))
        );
      } else {
        console.log('[GoogleHealthProvider] All permissions granted successfully');
      }
      
      await this.permissionManager.updatePermissionState(status);
      return status;
    } catch (error) {
      const errorMessage = mapHealthProviderError(error, 'google');
      console.error(
        '[GoogleHealthProvider] Permission request failed:',
        errorMessage,
        error instanceof Error ? error.stack : 'No stack trace'
      );
      
      await this.permissionManager.handlePermissionError('HealthConnect', error);
      
      // Log additional context about the failure
      console.error('[GoogleHealthProvider] Permission request context:', {
        initialized: this.initialized,
        platform: Platform.OS,
        permissions: HEALTH_PERMISSIONS.map(p => p.recordType)
      });
      
      return 'denied';
    }
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    if (!this.permissionManager) {
      const error = new HealthProviderPermissionError(
        'HealthConnect',
        'Permission manager not initialized'
      );
      console.error('[GoogleHealthProvider] Permission status check failed:', error.message);
      throw error;
    }

    console.log('[GoogleHealthProvider] Checking permission status');

    // First check cached state
    const cachedState = await this.permissionManager.getPermissionState();
    if (cachedState) {
      console.log('[GoogleHealthProvider] Using cached permission state:', cachedState);
      return cachedState;
    }

    try {
      if (!this.initialized) {
        console.log('[GoogleHealthProvider] Provider not initialized, checking Health Connect availability');
        const available = await initialize();
        
        if (!available) {
          console.error('[GoogleHealthProvider] Health Connect is not available');
          const state: PermissionState = {
            status: 'denied',
            lastChecked: Date.now(),
            deniedPermissions: ['HealthConnect']
          };
          await this.permissionManager.updatePermissionState('denied', ['HealthConnect']);
          return state;
        }
      }
      
      console.log('[GoogleHealthProvider] Verifying permissions');
      const hasPermissions = await this.verifyPermissions();
      const status: PermissionStatus = hasPermissions ? 'granted' : 'not_determined';
      
      if (status === 'not_determined') {
        console.warn('[GoogleHealthProvider] Permissions not determined, may need to request permissions');
      } else {
        console.log('[GoogleHealthProvider] Permissions verified successfully');
      }
      
      const state: PermissionState = {
        status,
        lastChecked: Date.now()
      };

      if (status !== 'granted') {
        const deniedPermissions = await this.getDeniedPermissions();
        if (deniedPermissions.length > 0) {
          state.deniedPermissions = deniedPermissions;
          console.warn('[GoogleHealthProvider] Found denied permissions:', 
            deniedPermissions.map(type => ({
              type,
              androidPermission: getAndroidPermission(type),
              description: getPermissionDescription(type)
            }))
          );
        }
      }

      await this.permissionManager.updatePermissionState(status);
      return state;
    } catch (error) {
      console.error(
        '[GoogleHealthProvider] Error checking permissions status:',
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error.stack : 'No stack trace'
      );

      const state: PermissionState = {
        status: 'denied',
        lastChecked: Date.now(),
        deniedPermissions: ['HealthConnect']
      };

      console.error('[GoogleHealthProvider] Defaulting to denied state due to error');
      await this.permissionManager.updatePermissionState('denied', ['HealthConnect']);
      return state;
    }
  }

  private async verifyPermissions(): Promise<boolean> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const testRange = {
      operator: 'between' as const,
      startTime: DateUtils.getStartOfDay(yesterday).toISOString(),
      endTime: now.toISOString(),
    };

    const verificationResults = new Map<PermissionType, boolean>();
    const permissionTypes = getAllRequiredPermissions();

    console.log('[GoogleHealthProvider] Starting permission verification for types:', permissionTypes);

    for (const permissionType of permissionTypes) {
      let retryCount = 0;
      let lastError: Error | null = null;

      while (retryCount < this.permissionVerificationRetries) {
        try {
          console.log(
            `[GoogleHealthProvider] Verifying permission for ${permissionType}`,
            retryCount > 0 ? `(Attempt ${retryCount + 1}/${this.permissionVerificationRetries})` : ''
          );

          const androidPermission = getAndroidPermission(permissionType);
          const result = await readRecords(permissionType, { timeRangeFilter: testRange });
          verificationResults.set(permissionType, result !== null);
          
          console.log(
            `[GoogleHealthProvider] Permission verification for ${permissionType}:`,
            `Success (${androidPermission})`
          );
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          console.error(
            `[GoogleHealthProvider] Permission verification attempt ${retryCount + 1} failed for ${permissionType}:`,
            formatPermissionError(permissionType, lastError)
          );
          
          if (retryCount < this.permissionVerificationRetries - 1) {
            const delay = this.permissionVerificationDelay * Math.pow(2, retryCount);
            console.log(`[GoogleHealthProvider] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          retryCount++;
        }
      }

      if (!verificationResults.has(permissionType)) {
        // If all retries failed, mark as failed unless it's BMR which is optional
        verificationResults.set(
          permissionType,
          permissionType === PERMISSION_TYPES.BMR
        );
      }
    }

    const failedPermissions = Array.from(verificationResults.entries())
      .filter(([_, success]) => !success)
      .map(([type]) => type as PermissionType);

    if (failedPermissions.length > 0) {
      console.error(
        '[GoogleHealthProvider] Permission verification failed for:',
        failedPermissions.map(type => ({
          type,
          androidPermission: getAndroidPermission(type),
          description: getPermissionDescription(type)
        }))
      );
      return false;
    }

    console.log('[GoogleHealthProvider] All permissions verified successfully');
    return true;
  }

  private async getDeniedPermissions(): Promise<PermissionType[]> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const testRange = {
      operator: 'between' as const,
      startTime: DateUtils.getStartOfDay(yesterday).toISOString(),
      endTime: now.toISOString(),
    };

    const deniedPermissions: PermissionType[] = [];
    const permissionTypes = getAllRequiredPermissions();

    for (const permissionType of permissionTypes) {
      try {
        const result = await readRecords(permissionType, { timeRangeFilter: testRange });
        if (!result) {
          deniedPermissions.push(permissionType);
          console.warn(
            `[GoogleHealthProvider] Permission denied for ${permissionType}:`,
            `Android permission: ${getAndroidPermission(permissionType)}`
          );
        }
      } catch (error) {
        deniedPermissions.push(permissionType);
        console.error(
          `[GoogleHealthProvider] Error checking permission for ${permissionType}:`,
          formatPermissionError(permissionType, error instanceof Error ? error : new Error('Unknown error'))
        );
      }
    }

    return deniedPermissions;
  }

  async handlePermissionDenial(): Promise<void> {
    await super.handlePermissionDenial();
    
    // Get and log denied permissions
    const deniedPermissions = await this.getDeniedPermissions();
    if (deniedPermissions.length > 0) {
      console.error('[GoogleHealthProvider] Permission denial details:', 
        deniedPermissions.map(type => ({
          type,
          androidPermission: getAndroidPermission(type),
          description: getPermissionDescription(type)
        }))
      );
    }
  }

  async fetchRawMetrics(
    startDate: Date,
    endDate: Date,
    types: MetricType[]
  ): Promise<RawHealthData> {
    console.log('[GoogleHealthProvider] Fetching raw metrics:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      types
    });

    // Check permissions before fetching
    try {
      console.log('[GoogleHealthProvider] Checking permissions status');
      const permissionState = await this.checkPermissionsStatus();
      
      if (permissionState.status !== 'granted') {
        const error = new HealthProviderPermissionError(
          'HealthConnect',
          `Permission not granted for health data access. Current status: ${permissionState.status}`
        );
        
        if (permissionState.deniedPermissions?.length) {
          console.error('[GoogleHealthProvider] Denied permissions:', 
            permissionState.deniedPermissions.map(type => ({
              type,
              androidPermission: getAndroidPermission(type as PermissionType),
              description: getPermissionDescription(type as PermissionType)
            }))
          );
        }
        
        throw error;
      }
    } catch (error) {
      console.error(
        '[GoogleHealthProvider] Permission check failed:',
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error.stack : 'No stack trace'
      );
      throw error;
    }

    try {
      console.log('[GoogleHealthProvider] Ensuring initialization');
      await this.ensureInitialized();
    } catch (error) {
      console.error(
        '[GoogleHealthProvider] Initialization check failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new HealthProviderPermissionError(
        'HealthConnect',
        'Failed to initialize Health Connect'
      );
    }

    console.log('[GoogleHealthProvider] Setting up time range filter');
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };

    const rawData: RawHealthData = {};
    const errors: Array<{ type: MetricType; error: Error }> = [];

    await Promise.all(
      types.map(async (type) => {
        try {
          console.log(`[GoogleHealthProvider] Fetching metric data for ${type}`);
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
                // Use the new verifyHealthPermission helper passing "this" as provider
                const hasBmrPermission = await verifyHealthPermission(this, 'BasalMetabolicRate');
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
        } catch (error) {
          const enhancedError = error instanceof Error ? error : new Error('Unknown error');
          console.error(
            `[GoogleHealthProvider] Error fetching ${type} data:`,
            enhancedError.message,
            enhancedError.stack
          );
          errors.push({ type, error: enhancedError });

          // Provide fallback data for the failed metric
          const fallbackData = {
            startDate: timeRangeFilter.startTime,
            endDate: timeRangeFilter.endTime,
            value: 0,
            unit: this.getFallbackUnit(type),
            sourceBundle: 'com.google.android.apps.fitness'
          };

          switch (type) {
            case 'steps':
              rawData.steps = [fallbackData];
              break;
            case 'distance':
              rawData.distance = [fallbackData];
              break;
            case 'calories':
              rawData.calories = [fallbackData];
              break;
            case 'heart_rate':
              rawData.heart_rate = [fallbackData];
              break;
            case 'basal_calories':
              rawData.basal_calories = [fallbackData];
              break;
            case 'flights_climbed':
              rawData.flights_climbed = [fallbackData];
              break;
            case 'exercise':
              rawData.exercise = [fallbackData];
              break;
          }
        }
      })
    );

    // Log any errors that occurred during metric fetching
    if (errors.length > 0) {
      console.error('[GoogleHealthProvider] Errors occurred while fetching metrics:', 
        errors.map(({ type, error }) => ({
          type,
          error: error.message,
          stack: error.stack
        }))
      );
    }

    return rawData;
  }

  private getFallbackUnit(type: MetricType): string {
    switch (type) {
      case 'steps':
        return 'count';
      case 'distance':
        return 'meters';
      case 'calories':
      case 'basal_calories':
        return 'kcal';
      case 'heart_rate':
        return 'bpm';
      case 'flights_climbed':
        return 'count';
      case 'exercise':
        return 'minutes';
      default:
        return 'count';
    }
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
