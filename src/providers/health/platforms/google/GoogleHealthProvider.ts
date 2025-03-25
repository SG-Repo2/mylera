import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';
import { mapHealthProviderError } from '../../../../utils/errorUtils';
import { BaseHealthProvider } from '../../types/provider';
import {  
  RawHealthData
} from '../../types/metrics';
import { MetricType } from '../../../../types/metrics';
import { DateUtils } from '../../../../utils/DateUtils';
import { PermissionState, PermissionStatus } from '../../types/permissions';
import { HealthProviderPermissionError } from '../../types/errors';
import { HEALTH_PERMISSIONS, verifyHealthConnectPermissions, requestHealthConnectPermissions } from './permissions';
import { logger, LogCategory } from '@/src/utils/logger';
import { performInitialization } from './initialization';
import { retryOperation, getPermissionVerified, isSecurityOrPermissionError } from './utils';
import {
  fetchStepsWithDailyAggregation,
  fetchDistanceWithDailyAggregation,
  fetchCaloriesWithDailyAggregation,
  fetchHeartRateWithDailyAggregation,
  fetchBasalCaloriesWithDailyAggregation,
  fetchFloorsClimbedWithDailyAggregation,
  fetchExerciseWithDailyAggregation
} from './metricFetchers';
import { HealthMetrics } from '../../types/metrics';


export default class GoogleHealthProvider extends BaseHealthProvider {
  private initializationPromise: Promise<void> | null = null;
  private androidVersion: number | null = null;
  private permissionRetryCount: number = 0;
  private lastPermissionRequest: number = 0;

  async getMetrics(): Promise<HealthMetrics> {
    try {
      const now = new Date();
      const startOfDay = DateUtils.getStartOfDay(now);
      
      return await this.batchFetchHealthMetrics(
        startOfDay,
        now,
        ['steps', 'distance', 'calories', 'heart_rate', 'basal_calories', 'flights_climbed', 'exercise']
      );
    } catch (error) {
      this.handleProviderError('fetching metrics', error);
    }
  }

  async initialize(): Promise<void> {
    logger.info(LogCategory.Health, '[GoogleHealthProvider] Initialize called. Current state:', undefined, undefined, {
      initialized: this.initialized,
      initializationInProgress: !!this.initializationPromise
    });

    if (this.initialized) {
      logger.info(LogCategory.Health, '[GoogleHealthProvider] Already initialized');
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      logger.info(LogCategory.Health, '[GoogleHealthProvider] Waiting for existing initialization...');
      await this.initializationPromise;
      return;
    }

    // Start new initialization
    logger.info(LogCategory.Health, '[GoogleHealthProvider] Starting new initialization');
    this.initializationPromise = performInitialization();
    try {
      await this.initializationPromise;
      this.initialized = true;
      logger.info(LogCategory.Health, '[GoogleHealthProvider] Initialization completed successfully');
    } catch (error) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Initialization failed:', error instanceof Error ? error.message : 'Unknown error');
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
      
      logger.info(LogCategory.Health, '[GoogleHealthProvider] Provider and permission manager initialized successfully');
      
      // Verify permissions directly with Health Connect
      await verifyHealthConnectPermissions();
    } catch (error) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Failed to initialize with permissions:', error instanceof Error ? error.message : 'Unknown error');
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
      
      // Check current permission state using direct verification
      const isVerified = await verifyHealthConnectPermissions();
      const status = isVerified ? 'granted' : 'not_determined';
      
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
      logger.info(LogCategory.Health, '[GoogleHealthProvider] Initializing permission manager...');
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

      // Use direct API verification for reliable permission check
      const hasPermissions = await verifyHealthConnectPermissions();
      
      return {
        status: hasPermissions ? 'granted' : 'not_determined',
        lastChecked: Date.now()
      };
    } catch (error) {
      logger.warn(LogCategory.Health, '[GoogleHealthProvider] Permission check failed:', error instanceof Error ? error.message : 'Unknown error');
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

      logger.info(LogCategory.Health, '[GoogleHealthProvider] Requesting Health Connect permissions - waiting for user consent');
      
      // Track timing for throttling
      this.lastPermissionRequest = Date.now();
      
      // Request permissions using the explicit prompt method
      const grantedPermissions = await requestHealthConnectPermissions();
      
      // Update permission state in manager
      const result = grantedPermissions.length >= 3;
      await this.permissionManager.updatePermissionState(
        result ? 'granted' : 'denied'
      );

      return result ? 'granted' : 'denied';
    } catch (error) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Error requesting permissions:', error instanceof Error ? error.message : 'Unknown error');
      
      // Mark as denied in the permission manager
      if (this.permissionManager) {
        await this.permissionManager.updatePermissionState('denied');
      }
      
      return 'denied';
    }
  }

  async handlePermissionDenial(): Promise<void> {
    await super.handlePermissionDenial();
    logger.info(LogCategory.Health, '[GoogleHealthProvider] Handling permission denial - resetting state');
    // Reset permission retry count on explicit denial
    this.permissionRetryCount = 0;
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
      await this.initializePermissions('temp-' + Date.now());
    }

    // Check for stored permission state first
    const storedVerification = await getPermissionVerified();
    
    // If we haven't verified permissions or they're known to be missing, verify or request them
    if (storedVerification === false || storedVerification === null) {
      logger.info(LogCategory.Health, '[GoogleHealthProvider] Permissions need verification before fetching metrics');
      
      // Check current permissions directly without UI
      const hasPermissions = await verifyHealthConnectPermissions();
      
      // If permissions aren't granted, request them with UI
      if (!hasPermissions) {
        logger.info(LogCategory.Health, '[GoogleHealthProvider] Permissions not verified, requesting with UI');
        const status = await this.requestPermissions();
        
        if (status !== 'granted') {
          logger.error(LogCategory.Health, '[GoogleHealthProvider] Permission request failed, cannot fetch health data');
          throw new HealthProviderPermissionError(
            'HealthConnect',
            'Permission not granted for health data access'
          );
        }
      }
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

    try {
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
            // Check specifically for permission errors
            if (isSecurityOrPermissionError(error)) {
              logger.warn(
                LogCategory.Health,
                `[GoogleHealthProvider] Security/Permission error fetching ${type}, will retry with fresh permissions`
              );
              
              // Limit retries to prevent infinite loops
              if (this.permissionRetryCount < 2) {
                this.permissionRetryCount++;
                
                // Throttle permission requests - don't request more than once per minute
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastPermissionRequest;
                if (timeSinceLastRequest > 60000) { 
                  // Request fresh permissions
                  await this.requestPermissions();
                  
                  // Try the operation again after getting fresh permissions
                  switch (type) {
                    case 'steps':
                      rawData.steps = await fetchStepsWithDailyAggregation(normalizedStartDate, normalizedEndDate);
                      break;
                    // Similar retry logic for other types
                    default:
                      rawData[type] = [];
                  }
                } else {
                  logger.warn(
                    LogCategory.Health,
                    `[GoogleHealthProvider] Skipping permission request - too soon (${timeSinceLastRequest}ms since last request)`
                  );
                  rawData[type] = [];
                }
              } else {
                logger.error(
                  LogCategory.Health,
                  `[GoogleHealthProvider] Too many permission retry attempts for ${type}`
                );
                rawData[type] = [];
              }
            } else {
              // Non-permission related error
              logger.error(
                LogCategory.Health, 
                `[GoogleHealthProvider] Error fetching ${type} metrics:`, 
                error instanceof Error ? error.message : 'Unknown error'
              );
              rawData[type] = [];
            }
          }
        })
      );
      
      // Reset retry counter on success
      this.permissionRetryCount = 0;
      
      return rawData;
    } catch (error) {
      // Global error handler
      logger.error(
        LogCategory.Health,
        '[GoogleHealthProvider] Failed to fetch health metrics:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      // Check for permission errors and handle them specially
      if (isSecurityOrPermissionError(error)) {
        await verifyHealthConnectPermissions();
      }
      
      throw error;
    }
  }
}