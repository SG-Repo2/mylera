import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import { HealthInputOptions } from 'react-native-health';
import { BaseHealthProvider } from '../../types/BaseHealthProvider';
import { 
  HealthMetrics, 
  RawHealthData, 
  NormalizedMetric
} from '../../types/metrics';
import { MetricType } from '../../../../types/schemas';
import { PermissionState, PermissionStatus } from '../../types/permissions';
import { HealthProviderPermissionError } from '../../types/errors';
import { DateUtils } from '../../../../utils/DateUtils';
import { logger, LogCategory } from '@/src/utils/logger';

// Import modules from other files
import { checkPlatformCompatibility, initializeHealthKit } from './initialization';
import { checkHealthKitAvailability, permissions } from './permissions';
import { 
  fetchStepsRaw,
  fetchDistanceRaw,
  fetchCaloriesRaw,
  fetchHeartRateRaw,
  fetchBasalCaloriesRaw,
  fetchFlightsClimbedRaw,
  fetchExerciseRaw
} from './metricFetchers';
import { normalizeHealthKitMetrics, aggregateHealthKitMetric } from './dataProcessing';
import { retryHealthKitOperation } from './utils';

export class AppleHealthProvider extends BaseHealthProvider {
  private iosVersion: number | null = null;
  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async initialize(): Promise<void> {
    // Use the extracted platform compatibility check
    checkPlatformCompatibility();

    // Store iOS version for reference
    this.iosVersion = Platform.Version ? parseFloat(Platform.Version.toString()) : null;

    if (this.initialized) {
      return;
    }

    // Use the extracted initialization function
    await initializeHealthKit();
    this.initialized = true;
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
          const available = await checkHealthKitAvailability();
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
    await this.ensurePermissionsInitialized();

    // If we still don't have a permission manager, use a default state
    if (!this.permissionManager) {
      logger.error(LogCategory.Health, '[AppleHealthProvider] Permission manager still null after initialization attempt');
      return {
        status: 'not_determined',
        lastChecked: Date.now()
      };
    }

    // First check cached state
    try {
      const cachedState = await this.permissionManager.getPermissionState();
      if (cachedState) {
        return cachedState;
      }
    } catch (error) {
      logger.warn(LogCategory.Health, '[AppleHealthProvider] Error getting cached permission state:', (error as Error).message);
    }

    // If no cached state, check current status
    try {
      const available = await checkHealthKitAvailability();
      const status: PermissionStatus = available ? 'granted' : 'not_determined';
      
      const state: PermissionState = {
        status,
        lastChecked: Date.now()
      };
  
      // Only try to update if permission manager exists
      if (this.permissionManager) {
        await this.permissionManager.updatePermissionState(status);
      }
      
      return state;
    } catch (error) {
      logger.error(LogCategory.Health, '[AppleHealthProvider] Error checking availability:', (error as Error).message);
      return {
        status: 'not_determined',
        lastChecked: Date.now()
      };
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
            rawData.steps = await fetchStepsRaw(options);
            break;
          case 'distance':
            rawData.distance = await fetchDistanceRaw(options);
            break;
          case 'calories':
            rawData.calories = await fetchCaloriesRaw(options);
            break;
          case 'heart_rate':
            rawData.heart_rate = await fetchHeartRateRaw(options);
            break;
          case 'basal_calories':
            rawData.basal_calories = await fetchBasalCaloriesRaw(options);
            break;
          case 'flights_climbed':
            rawData.flights_climbed = await fetchFlightsClimbedRaw(options);
            break;
          case 'exercise':
            rawData.exercise = await fetchExerciseRaw(options);
            break;
        }
      })
    );

    return rawData;
  }

  normalizeMetrics(rawData: RawHealthData, type: MetricType): NormalizedMetric[] {
    return normalizeHealthKitMetrics(rawData, type);
  }

  /**
   * Fetch health metrics from Apple HealthKit.
   * This is the internal implementation that gets called after ensuring proper initialization.
   * @returns Aggregated health metrics
   */
  protected async fetchMetrics(): Promise<HealthMetrics> {
    try {
      // Your existing getMetrics implementation here
      // This will now be called after ensuring proper initialization
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      logger.info(LogCategory.Health, '[AppleHealthProvider] Fetching metrics for time window:', 
        `start: ${startOfDay.toISOString()}, end: ${now.toISOString()}`
      );
      
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

  // Add a helper method to ensure permissions are initialized
  protected async ensurePermissionsInitialized(): Promise<void> {
    if (!this.permissionManager) {
      // Try to initialize with a default user ID if one wasn't provided
      const userId = 'default-user-id';
      logger.warn(LogCategory.Health, `[AppleHealthProvider] Attempting to initialize permissions with default user ID: ${userId}`);
      await this.initializePermissions(userId);
    }
  }

  protected async batchFetchHealthMetrics(
    startDate: Date,
    endDate: Date,
    metricTypes: MetricType[]
  ): Promise<HealthMetrics> {
    const emptyMetrics: HealthMetrics = {
      id: '',
      user_id: '',
      date: new Date().toISOString().split('T')[0],
      steps: null,
      distance: null,
      calories: null,
      heart_rate: null,
      exercise: null,
      basal_calories: null,
      flights_climbed: null,
      daily_score: 0,
      weekly_score: null,
      streak_days: null,
      last_updated: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Skip empty requests
    if (!metricTypes.length) {
      return emptyMetrics;
    }
    
    try {
      // Check permissions before fetching
      if (!this.permissionManager) {
        logger.warn(LogCategory.Health, 
          `[AppleHealthProvider] Permission manager is null during batchFetchHealthMetrics`
        );
        // Instead of using a default user ID, throw an error
        throw new Error('Permission manager not initialized');
      }

      const permissionState = await this.checkPermissionsStatus();
      if (permissionState.status !== 'granted') {
        await this.requestPermissions();
      }

      // Fetch all raw metrics in one call
      const rawData = await this.fetchRawMetrics(startDate, endDate, metricTypes);
      
      // Process metrics with standard method
      const processedMetrics: Partial<HealthMetrics> = {};
      
      // Process each requested metric type
      for (const type of metricTypes) {
        try {
          const normalizedMetrics = this.normalizeMetrics(rawData, type);
          const aggregatedValue = this.standardizedAggregateMetric(normalizedMetrics);
          processedMetrics[type] = aggregatedValue;
        } catch (metricError) {
          logger.warn(
            LogCategory.Health, 
            `[AppleHealthProvider] Error processing ${type} metric: ${metricError instanceof Error ? metricError.message : 'Unknown error'}`
          );
          processedMetrics[type] = null;
        }
      }

      return {
        ...emptyMetrics,
        ...processedMetrics,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      logger.error(LogCategory.Health, '[AppleHealthProvider] Error in batchFetchHealthMetrics:', (error as Error).message);
      throw error;
    }
  }
}
