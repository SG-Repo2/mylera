import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthKitPermissions,
  HealthInputOptions,
} from 'react-native-health';
import { promisify } from '../../../../utils/promiseWrapper';
import { aggregateMetrics } from '../../../../utils/healthMetricUtils';
import { permissions, HEALTH_PERMISSIONS } from './permissions';
import { BaseHealthProvider } from '../../types/provider';
import type { 
  HealthMetrics, 
  RawHealthData, 
  RawHealthMetric,
  NormalizedMetric
} from '../../types/metrics';
import { METRIC_UNITS } from '../../types/metrics';
import { MetricType } from '../../../../types/schemas';
import { PermissionState, PermissionStatus } from '../../types/permissions';
import { HealthProviderPermissionError } from '../../types/errors';
import { DateUtils } from '../../../../utils/DateUtils';
import { logger, LogCategory } from '@/src/utils/logger';

export class AppleHealthProvider extends BaseHealthProvider {
  private iosVersion: number | null = null;

  async initialize(): Promise<void> {
    if (Platform.OS !== 'ios') {
      logger.error(LogCategory.Health, '[AppleHealthProvider] Can only be used on iOS');
      throw new Error('AppleHealthProvider can only be used on iOS');
    }

    // Check iOS version (HealthKit requires iOS 8+)
    this.iosVersion = Platform.Version ? parseFloat(Platform.Version.toString()) : null;
    logger.info(LogCategory.Health, `[AppleHealthProvider] iOS version: ${this.iosVersion}`);
    
    if (this.iosVersion !== null && this.iosVersion < 8) {
      logger.error(LogCategory.Health, '[AppleHealthProvider] HealthKit requires iOS 8 or newer');
      throw new Error('HealthKit requires iOS 8 or newer');
    }

    if (this.initialized) {
      return;
    }

    // Use promisify with retry mechanism
    try {
      await this.retryOperation(
        () => new Promise<void>((resolve, reject) => {
          AppleHealthKit.initHealthKit(permissions, (error: string) => {
            if (error) {
              reject(new Error(error));
              return;
            }
            resolve();
          });
        }),
        2,  // 2 retries
        500  // 500ms initial delay
      );
      
      this.initialized = true;
      logger.info(LogCategory.Health, '[AppleHealthProvider] Successfully initialized');
    } catch (error) {
      logger.error(LogCategory.Health, '[AppleHealthProvider] Initialization failed:', (error as Error).message);
      throw error;
    }
  }

  async requestPermissions(): Promise<PermissionStatus> {
    if (!this.permissionManager) {
      logger.error(LogCategory.Health, '[AppleHealthProvider] Permission manager not initialized during requestPermissions');
      await this.ensurePermissionsInitialized();
      
      // If still not initialized, throw error
      if (!this.permissionManager) {
        throw new Error('Permission manager could not be initialized');
      }
    }

    try {
      await this.initialize();

      // Check if permissions are already granted
      const currentState = await this.checkPermissionsStatus();
      if (currentState.status === 'granted') {
        return 'granted';
      }

      // Request permissions through HealthKit
      return new Promise((resolve) => {
        AppleHealthKit.initHealthKit(permissions, async (error: string) => {
          if (error) {
            // Handle null permissionManager safely
            if (this.permissionManager) {
              await this.permissionManager.updatePermissionState('denied');
            }
            resolve('denied');
            return;
          }

          // Verify permissions were actually granted
          const available = await this.checkAvailability();
          const status: PermissionStatus = available ? 'granted' : 'denied';
          
          // Handle null permissionManager safely
          if (this.permissionManager) {
            await this.permissionManager.updatePermissionState(status);
          }
          resolve(status);
        });
      });
    } catch (error) {
      // Handle null permissionManager safely
      if (this.permissionManager) {
        await this.permissionManager.handlePermissionError(
          'HealthKit',
          error
        );
      }
      return 'denied';
    }
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    // Try to ensure permission manager is initialized
    if (!this.permissionManager) {
      logger.warn(LogCategory.Health, '[AppleHealthProvider] Permission manager not initialized during checkPermissionsStatus');
      try {
        await this.ensurePermissionsInitialized();
      } catch (error) {
        logger.error(LogCategory.Health, '[AppleHealthProvider] Failed to initialize permissions', (error as Error).message);
        // Return a default state if initialization fails
        return {
          status: 'not_determined',
          lastChecked: Date.now()
        };
      }
    }

    // If we still don't have a permission manager, use a default state
    if (!this.permissionManager) {
      logger.error(LogCategory.Health, '[AppleHealthProvider] Permission manager still null after initialization attempt');
      return {
        status: 'not_determined',
        lastChecked: Date.now()
      };
    }

    // First check cached state
    const cachedState = await this.permissionManager.getPermissionState();
    if (cachedState) {
      return cachedState;
    }

    // If no cached state, check current status
    const available = await this.checkAvailability();
    const status: PermissionStatus = available ? 'granted' : 'not_determined';
    
    const state: PermissionState = {
      status,
      lastChecked: Date.now()
    };

    await this.permissionManager.updatePermissionState(status);
    return state;
  }

  private async checkAvailability(): Promise<boolean> {
    try {
      const available = await promisify<boolean>(AppleHealthKit.isAvailable);
      return available;
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
        'HealthKit',
        'Permission not granted for health data access'
      );
    }

    await this.ensureInitialized();

    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    const rawData: RawHealthData = {};

    await Promise.all(
      types.map(async (type) => {
        switch (type) {
          case 'steps':
            rawData.steps = await this.fetchStepsRaw(options);
            break;
          case 'distance':
            rawData.distance = await this.fetchDistanceRaw(options);
            break;
          case 'calories':
            rawData.calories = await this.fetchCaloriesRaw(options);
            break;
          case 'heart_rate':
            rawData.heart_rate = await this.fetchHeartRateRaw(options);
            break;
          case 'basal_calories':
            rawData.basal_calories = await this.fetchBasalCaloriesRaw(options);
            break;
          case 'flights_climbed':
            rawData.flights_climbed = await this.fetchFlightsClimbedRaw(options);
            break;
          case 'exercise':
            rawData.exercise = await this.fetchExerciseRaw(options);
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
          console.log('[AppleHealthProvider] Normalizing distance metrics:', {
            rawMetrics: rawData.distance,
            rawTotal: rawData.distance.reduce((sum, m) => sum + (m.value || 0), 0)
          });
          const normalizedDistanceMetrics = rawData.distance.map(raw => ({
            timestamp: raw.endDate,
            value: Number(raw.value), // Keep in meters
            unit: METRIC_UNITS.DISTANCE,
            type: 'distance'
          } as NormalizedMetric));
          metrics.push(...normalizedDistanceMetrics);
          console.log('[AppleHealthProvider] Normalized distance metrics:', {
            normalizedMetrics: normalizedDistanceMetrics,
            normalizedTotal: normalizedDistanceMetrics.reduce((sum, m) => sum + m.value, 0)
          });
        } else {
          console.log('[AppleHealthProvider] No distance data to normalize');
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
    const now = new Date();
    const startOfDay = DateUtils.getStartOfDay(now);
    
    console.log('[AppleHealthProvider] Fetching metrics for time window:', {
      start: startOfDay.toISOString(),
      end: now.toISOString()
    });
    
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

  private async fetchStepsRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    try {
      // Use retry mechanism for HealthKit calls
      const results = await this.retryOperation(
        () => promisify<{ value: number }>(AppleHealthKit.getStepCount, options),
        2,  // 2 retries
        500  // 500ms initial delay
      );
      
      return [{
        startDate: options.startDate || new Date().toISOString(),
        endDate: options.endDate || new Date().toISOString(),
        value: results.value || 0,
        unit: 'count',
        sourceBundle: 'com.apple.health'
      }];
    } catch (error) {
      logger.error(LogCategory.Health, '[AppleHealthProvider] Error reading steps:', (error as Error).message);
      return [];
    }
  }

  private async fetchDistanceRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    try {
      logger.debug(LogCategory.Health, '[AppleHealthProvider] Fetching distance with options:', undefined, undefined, options);
      
      // Use retry mechanism for distance
      const results = await this.retryOperation(
        () => promisify<any>(AppleHealthKit.getDistanceWalkingRunning, options),
        2, 
        500
      );
      
      console.log('[AppleHealthProvider] Distance raw results:', results);

      // Log the type of results to help with debugging
      console.log('[AppleHealthProvider] Results type:', {
        isObject: typeof results === 'object',
        hasValue: 'value' in (results || {}),
        valueType: typeof results?.value,
        keys: results ? Object.keys(results) : []
      });

      // Handle the case where results is a plain object with startDate, endDate, and value
      if (results && typeof results === 'object' && 'startDate' in results && 'endDate' in results && typeof results.value === 'number') {
        const metric = {
          startDate: results.startDate,
          endDate: results.endDate,
          value: Math.round(results.value),
          unit: 'meters',
          sourceBundle: 'com.apple.health'
        };
        
        console.log('[AppleHealthProvider] Processed plain distance result:', metric);
        return [metric];
      }
      
      // Handle legacy allResults format (keeping for backward compatibility)
      if (results?.allResults && typeof results.allResults.value === 'number') {
        const metric = {
          startDate: results.allResults.startDate || options.startDate,
          endDate: results.allResults.endDate || options.endDate,
          value: Math.round(results.allResults.value),
          unit: 'meters',
          sourceBundle: 'com.apple.health'
        };
        
        console.log('[AppleHealthProvider] Processed single distance result:', metric);
        return [metric];
      }
      
      // Handle array response format
      if (Array.isArray(results) && results.length > 0) {
        const mappedResults = results.map(sample => ({
          startDate: sample.startDate,
          endDate: sample.endDate,
          value: Math.round(sample.value || 0),
          unit: 'meters',
          sourceBundle: 'com.apple.health'
        }));

        console.log('[AppleHealthProvider] Processed distance results:', {
          totalResults: mappedResults.length,
          totalValue: mappedResults.reduce((sum, item) => sum + item.value, 0),
          samples: mappedResults
        });

        return mappedResults;
      }

      // No valid results found
      console.log('[AppleHealthProvider] No valid distance results found, returning 0');
      return [{
        startDate: options.startDate || new Date().toISOString(),
        endDate: options.endDate || new Date().toISOString(),
        value: 0,
        unit: 'meters',
        sourceBundle: 'com.apple.health'
      }];
    } catch (error) {
      logger.error(LogCategory.Health, '[AppleHealthProvider] Error reading distance:', (error as Error).message);
      return [];
    }
  }

  private async fetchCaloriesRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    try {
      console.log('[AppleHealthProvider] Fetching calories with options:', options);
      const results = await promisify<Array<{ value: number; startDate: string; endDate: string }>>(
        AppleHealthKit.getActiveEnergyBurned,
        options
      );
      console.log('[AppleHealthProvider] Calories raw results:', results);
      
      if (!Array.isArray(results) || results.length === 0) {
        return [{
          startDate: options.startDate || new Date().toISOString(),
          endDate: options.endDate || new Date().toISOString(),
          value: 0,
          unit: 'kcal',
          sourceBundle: 'com.apple.health'
        }];
      }

      return results.map(sample => ({
        startDate: sample.startDate,
        endDate: sample.endDate,
        value: Math.round(sample.value || 0),
        unit: 'kcal',
        sourceBundle: 'com.apple.health'
      }));
    } catch (error) {
      console.error('[AppleHealthProvider] Error reading active calories:', error);
      return [];
    }
  }

  private async fetchBasalCaloriesRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    try {
      const results = await promisify<{ value: number }>(
        AppleHealthKit.getBasalEnergyBurned,
        options
      );
      return [{
        startDate: options.startDate || new Date().toISOString(),
        endDate: options.endDate || new Date().toISOString(),
        value: Math.round(results.value || 0),
        unit: 'kcal',
        sourceBundle: 'com.apple.health'
      }];
    } catch (error) {
      console.error('[AppleHealthProvider] Error reading basal calories:', error);
      return [];
    }
  }

  private async fetchHeartRateRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    try {
      const results = await promisify<Array<{ value: number; startDate: string; endDate: string }>>(
        AppleHealthKit.getHeartRateSamples,
        {
          ...options,
          ascending: false,
          limit: 100, // Get more samples for better accuracy
        }
      );

      // Filter out invalid readings
      const validSamples = results
        .filter(sample =>
          typeof sample.value === 'number' &&
          !isNaN(sample.value) &&
          sample.value > 30 && // More realistic minimum heart rate
          sample.value < 220 // Maximum realistic heart rate
        )
        .map(sample => ({
          startDate: sample.startDate,
          endDate: sample.endDate,
          value: Math.round(sample.value),
          unit: 'bpm',
          sourceBundle: 'com.apple.health'
        }));

      if (validSamples.length === 0) {
        return [{
          startDate: options.startDate || new Date().toISOString(),
          endDate: options.endDate || new Date().toISOString(),
          value: 0,
          unit: 'bpm',
          sourceBundle: 'com.apple.health'
        }];
      }

      return validSamples;
    } catch (error) {
      console.error('[AppleHealthProvider] Error reading heart rate:', error);
      return [];
    }
  }

  private async fetchFlightsClimbedRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    try {
      const results = await promisify<{ value: number }>(
        AppleHealthKit.getFlightsClimbed,
        options
      );
      return [{
        startDate: options.startDate || new Date().toISOString(),
        endDate: options.endDate || new Date().toISOString(),
        value: Math.round(results.value || 0),
        unit: 'count',
        sourceBundle: 'com.apple.health'
      }];
    } catch (error) {
      console.error('[AppleHealthProvider] Error reading flights climbed:', error);
      return [];
    }
  }

  private async fetchExerciseRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    try {
      const results = await promisify<{ value: number }>(
        AppleHealthKit.getAppleExerciseTime,
        options
      );
      return [{
        startDate: options.startDate || new Date().toISOString(),
        endDate: options.endDate || new Date().toISOString(),
        value: Math.round(results.value || 0),
        unit: 'minutes',
        sourceBundle: 'com.apple.health'
      }];
    } catch (error) {
      console.error('[AppleHealthProvider] Error reading exercise time:', error);
      return [];
    }
  }

  private aggregateMetric(metrics: NormalizedMetric[]): number {
    return aggregateMetrics(metrics);
  }

  // Add a helper method to ensure permissions are initialized
  private async ensurePermissionsInitialized(): Promise<void> {
    if (!this.permissionManager) {
      // Try to initialize with a default user ID if one wasn't provided
      const userId = 'default-user-id';
      logger.warn(LogCategory.Health, `[AppleHealthProvider] Attempting to initialize permissions with default user ID: ${userId}`);
      await this.initializePermissions(userId);
    }
  }
}
