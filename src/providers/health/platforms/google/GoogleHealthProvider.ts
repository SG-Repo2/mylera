import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';
import { mapHealthProviderError } from '../../../../utils/errorUtils';
import { BaseHealthProvider } from '../../types/provider';
import { 
  HealthMetrics, 
  RawHealthData, 
  NormalizedMetric,
  METRIC_UNITS, 
  RawHealthMetric
} from '../../types/metrics';
import { MetricType } from '../../../../types/metrics';
import { DateUtils } from '../../../../utils/DateUtils';
import { PermissionState, PermissionStatus } from '../../types/permissions';
import { HealthProviderPermissionError } from '../../types/errors';
import { hasEssentialPermissions, HEALTH_PERMISSIONS } from './permissions';
import { logger, LogCategory } from '@/src/utils/logger';
import { performInitialization } from './initialization';
import { retryOperation } from './utils';
import {
  fetchStepsWithDailyAggregation,
  fetchDistanceWithDailyAggregation,
  fetchCaloriesWithDailyAggregation,
  fetchHeartRateWithDailyAggregation,
  fetchBasalCaloriesWithDailyAggregation,
  fetchFloorsClimbedWithDailyAggregation,
  fetchExerciseWithDailyAggregation
} from './metricFetchers';


export default class GoogleHealthProvider extends BaseHealthProvider {
  private initializationPromise: Promise<void> | null = null;
  private androidVersion: number | null = null;

  private async performInitialization(): Promise<void> {
    if (Platform.OS !== 'android') {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Attempted to initialize on non-Android platform');
      throw new Error('GoogleHealthProvider can only be used on Android');
    }

    // Check Android version for Health Connect compatibility
    this.androidVersion = Platform.Version ? parseInt(Platform.Version.toString(), 10) : null;
    logger.info(LogCategory.Health, `[GoogleHealthProvider] Android version: ${this.androidVersion}`);
    
    if (this.androidVersion !== null && this.androidVersion < 8) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Health Connect requires Android 8 or newer');
      throw new Error('Health Connect requires Android 8 or newer');
    }

    logger.info(LogCategory.Health, '[GoogleHealthProvider] Starting initialization...');
    
    try {
      // Use retry mechanism with exponential backoff
      const available = await this.retryOperation(
        () => initialize(),
        3, // 3 retries
        1000 // 1 second initial delay
      );
      
      logger.info(LogCategory.Health, '[GoogleHealthProvider] Health Connect availability:', available ? 'available' : 'not available');
      
      if (!available) {
        logger.error(LogCategory.Health, '[GoogleHealthProvider] Health Connect is not available');
        throw new Error('Health Connect is not available');
      }

      this.initialized = true;
      logger.info(LogCategory.Health, '[GoogleHealthProvider] Initialization successful');
    } catch (error) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Initialization failed:', (error as Error).message);
      // Wrap the error to ensure consistent messaging
      if (error instanceof Error) {
        if (error.message.includes('not available')) {
          throw new Error('Health Connect is not available');
        }
      }
      throw error;
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
    this.initializationPromise = performInitialization();
    try {
      await this.initializationPromise;
      this.initialized = true;
      console.log('[GoogleHealthProvider] Initialization completed successfully');
    } catch (error) {
      console.error('[GoogleHealthProvider] Initialization failed:', error);
      throw error;
    } finally {
      this.initializationPromise = null;
    }
  }

  async initializeWithPermissions(userId: string): Promise<void> {
    try {
      // First ensure provider is initialized 
      await this.initialize();
      
      // Then initialize the permission manager
      await this.initializePermissions(userId);
      
      console.log('[GoogleHealthProvider] Provider and permission manager initialized successfully');
      
      // Don't verify permissions here - wait for explicit permission request
    } catch (error) {
      console.error('[GoogleHealthProvider] Failed to initialize with permissions:', error);
      throw error;
    }
  }

  /**
   * Safely initializes the health provider and permission manager.
   * This method ensures both components are properly initialized with the correct user ID.
   */
  async safeInitialize(userId: string): Promise<PermissionStatus> {
    if (!userId || userId === 'temp-user-id') {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Cannot initialize with invalid user ID:', userId);
      throw new Error('Valid user ID is required for initialization');
    }

    logger.info(LogCategory.Health, `[GoogleHealthProvider] Safe initialization starting for user: ${userId}`);

    try {
      // First initialize the provider itself
      await this.initialize();
      
      // Then ensure permission manager is initialized with the correct user ID
      if (!this.permissionManager) {
        logger.info(LogCategory.Health, `[GoogleHealthProvider] Initializing permission manager for user: ${userId}`);
        await this.initializePermissions(userId);
      }
      
      // Check current permission state
      const permissionState = await this.checkPermissionsStatus();
      const status = typeof permissionState === 'string' ? permissionState : permissionState.status;
      
      // If permissions are not granted, request them
      if (status !== 'granted') {
        logger.info(LogCategory.Health, '[GoogleHealthProvider] Permissions not granted, requesting permissions...');
        const requestStatus = await this.requestPermissions();
        
        if (requestStatus !== 'granted') {
          logger.warn(LogCategory.Health, '[GoogleHealthProvider] Permission request failed or was denied');
          return 'denied';
        }
      }
      
      logger.info(LogCategory.Health, `[GoogleHealthProvider] Safe initialization completed with permission status: ${status}`);
      return status as PermissionStatus;
    } catch (error) {
      logger.error(
        LogCategory.Health, 
        `[GoogleHealthProvider] Safe initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  protected async ensurePermissionsInitialized(): Promise<void> {
    if (!this.permissionManager) {
      console.log('[GoogleHealthProvider] Initializing permission manager...');
      const tempId = 'temp-' + Date.now();
      await this.initializePermissions(tempId);
    }
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    try {
      await this.ensurePermissionsInitialized();
      
      if (!this.permissionManager) {
        throw new Error('Permission manager initialization failed');
      }

      // Verify permissions are granted
      const hasPermissions = await this.verifyPermissions();
      
      return {
        status: hasPermissions ? 'granted' : 'not_determined',
        lastChecked: Date.now()
      };
    } catch (error) {
      console.warn('[GoogleHealthProvider] Permission check failed:', error);
      return {
        status: 'not_determined',
        lastChecked: Date.now()
      };
    }
  }

  async requestPermissions(): Promise<PermissionStatus> {
    try {
      await this.ensurePermissionsInitialized();
      
      if (!this.permissionManager) {
        throw new Error('Cannot request permissions - permission manager not initialized');
      }

      logger.info(LogCategory.Health, '[GoogleHealthProvider] Requesting Health Connect permissions...');
      
      // Request permissions using Health Connect API
      const granted = await requestPermission(HEALTH_PERMISSIONS);
      
      // Update permission state in manager
      const status = granted ? 'granted' : 'denied';
      await this.permissionManager.updatePermissionState(status);
      
      logger.info(LogCategory.Health, `[GoogleHealthProvider] Permission request completed with status: ${status}`);
      
      return status;
    } catch (error) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Error requesting permissions:', error instanceof Error ? error.message : 'Unknown error');
      return 'denied';
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

      // Check each permission individually and track results
      const permissionResults = {
        steps: false,
        distance: false,
        calories: false,
        heartRate: false,
        floorsClimbed: false,
        basal: false,
        exercise: false
      };

      // Test each permission individually with proper error handling
      for (const permission of HEALTH_PERMISSIONS) {
        try {
          const records = await readRecords(permission.recordType, {
            timeRangeFilter: testRange
          });
          if (records.records?.length > 0) {
            switch (permission.recordType) {
              case 'Steps':
                permissionResults.steps = true;
                break;
              case 'Distance':
                permissionResults.distance = true;
                break;
              case 'ActiveCaloriesBurned':
                permissionResults.calories = true;
                break;
              case 'HeartRate':
                permissionResults.heartRate = true;
                break;
              case 'FloorsClimbed':
                permissionResults.floorsClimbed = true;
                break;
              case 'BasalMetabolicRate':
                permissionResults.basal = true;
                break;
              case 'ExerciseSession':
                permissionResults.exercise = true;
                break;
            }
          }
        } catch (error) {
          logger.warn(LogCategory.Health, `[GoogleHealthProvider] Error checking ${permission.recordType} permission:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }

      logger.info(LogCategory.Health, '[GoogleHealthProvider] Permission verification results:', JSON.stringify(permissionResults));

      // Check if essential permissions are granted
      const hasEssential = hasEssentialPermissions(
        Object.entries(permissionResults)
          .filter(([_, granted]) => granted)
          .map(([permission]) => permission)
      );

      if (!hasEssential) {
        logger.warn(LogCategory.Health, '[GoogleHealthProvider] Insufficient permissions granted');
        return false;
      }

      return true;
    } catch (error) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Error verifying permissions:', error instanceof Error ? error.message : 'Unknown error');
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
    // Check if permission manager is initialized
    if (!this.permissionManager) {
      logger.warn(
        LogCategory.Health,
        '[GoogleHealthProvider] Permission manager is null during fetchRawMetrics, attempting to initialize',
      );
      
      // Use a temporary user ID since we can't access the current one
      await this.initializePermissions('temp-user-id');
    }

    // Check permissions before fetching
    const permissionState = await this.checkPermissionsStatus();
    if (permissionState.status !== 'granted') {
      console.log('[GoogleHealthProvider] Permissions not granted, cannot fetch health data');
      throw new HealthProviderPermissionError(
        'HealthConnect',
        'Permission not granted for health data access'
      );
    }

    await this.ensureInitialized();
    
    // For bar chart purposes, we need to ensure we're requesting whole days
    const normalizedStartDate = DateUtils.getStartOfDay(startDate);
    const normalizedEndDate = DateUtils.getEndOfDay(endDate);

    const rawData: RawHealthData = {};

    logger.info(LogCategory.Health, '[GoogleHealthProvider] Fetching health data for time range:', undefined, undefined, {
      start: normalizedStartDate.toISOString(),
      end: normalizedEndDate.toISOString(),
      types: types.join(', ')
    });

    await Promise.all(
      types.map(async (type) => {
        try {
          switch (type) {
            case 'steps':
              rawData.steps = await fetchStepsWithDailyAggregation(normalizedStartDate, normalizedEndDate);
              break;

            case 'distance':
              rawData.distance = await fetchDistanceWithDailyAggregation(normalizedStartDate, normalizedEndDate);
              break;

            case 'calories':
              rawData.calories = await fetchCaloriesWithDailyAggregation(normalizedStartDate, normalizedEndDate);
              break;

            case 'heart_rate':
              rawData.heart_rate = await fetchHeartRateWithDailyAggregation(normalizedStartDate, normalizedEndDate);
              break;

            case 'basal_calories':
              rawData.basal_calories = await fetchBasalCaloriesWithDailyAggregation(normalizedStartDate, normalizedEndDate);
              break;

            case 'flights_climbed':
              rawData.flights_climbed = await fetchFloorsClimbedWithDailyAggregation(normalizedStartDate, normalizedEndDate);
              break;

            case 'exercise':
              rawData.exercise = await fetchExerciseWithDailyAggregation(normalizedStartDate, normalizedEndDate);
              break;
          }
        } catch (error) {
          logger.error(
            LogCategory.Health, 
            `[GoogleHealthProvider] Error fetching ${type} metrics:`, 
            error instanceof Error ? error.message : 'Unknown error'
          );
          // Create empty array instead of dummy data
          rawData[type] = [];
        }
      })
    );

    return rawData;
  }

  normalizeMetrics(rawData: RawHealthData, type: MetricType): NormalizedMetric[] {
    // Use the standardized implementation from BaseHealthProvider
    return super.normalizeMetrics(rawData, type);
  }

  async getMetrics(): Promise<HealthMetrics> {
    try {
      const now = new Date();
      const startOfDay = DateUtils.getStartOfDay(now);
      
      console.log('[GoogleHealthProvider] Fetching metrics for time window:', {
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
}