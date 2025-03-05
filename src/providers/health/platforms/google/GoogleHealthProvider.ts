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
  METRIC_UNITS, 
  RawHealthMetric
} from '../../types/metrics';
import { MetricType } from '../../../../types/metrics';
import { DateUtils } from '../../../../utils/DateUtils';
import { PermissionState, PermissionStatus } from '../../types/permissions';
import { HealthProviderPermissionError } from '../../types/errors';
import { HEALTH_PERMISSIONS } from './permissions';
import { logger, LogCategory } from '@/src/utils/logger';

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

  async requestPermissions(): Promise<PermissionStatus> {
    if (!this.permissionManager) {
      console.error('[GoogleHealthProvider] Cannot request permissions - permission manager not initialized');
      return 'not_determined';
    }

    try {
      await this.ensureInitialized();

      // Check if permissions are already granted
      const currentState = await this.checkPermissionsStatus();
      if (currentState.status === 'granted') {
        return 'granted';
      }

      // Log that we're about to request permissions (user interaction required)
      console.log('[GoogleHealthProvider] Requesting Health Connect permissions - waiting for user consent');
      
      // Request permissions through Health Connect - this will show the permission dialog
      await requestPermission(HEALTH_PERMISSIONS);
      
      // After user interaction, verify if permissions were actually granted
      const verificationResult = await this.verifyPermissions();
      const status: PermissionStatus = verificationResult ? 'granted' : 'denied';
      
      // Update permission state in cache
      await this.permissionManager.updatePermissionState(status);
      console.log(`[GoogleHealthProvider] Permissions ${status === 'granted' ? 'granted' : 'denied'} by user`);
      return status;
    } catch (error) {
      const errorMessage = mapHealthProviderError(error, 'google');
      console.error('[GoogleHealthProvider]', errorMessage);
      await this.permissionManager.handlePermissionError('HealthConnect', error);
      return 'denied';
    }
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    // Validate permission manager exists
    if (!this.permissionManager) {
      console.warn('[GoogleHealthProvider] Permission manager not initialized, returning not_determined');
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

    try {
      // Check if Health Connect is available
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
      
      // Don't actively verify permissions unless we already have a cached state
      // This prevents security exceptions during initialization
      const state: PermissionState = {
        status: 'not_determined',
        lastChecked: Date.now()
      };
      
      await this.permissionManager.updatePermissionState('not_determined');
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
      try {
        const stepsResult = await readRecords('Steps', { timeRangeFilter: testRange });
        permissionResults.steps = true;
      } catch (error) {
        console.warn('[GoogleHealthProvider] Steps permission verification failed:', error);
      }

      try {
        const distanceResult = await readRecords('Distance', { timeRangeFilter: testRange });
        permissionResults.distance = true;
      } catch (error) {
        console.warn('[GoogleHealthProvider] Distance permission verification failed:', error);
      }

      try {
        const caloriesResult = await readRecords('ActiveCaloriesBurned', { timeRangeFilter: testRange });
        permissionResults.calories = true;
      } catch (error) {
        console.warn('[GoogleHealthProvider] Calories permission verification failed:', error);
      }

      try {
        const heartRateResult = await readRecords('HeartRate', { timeRangeFilter: testRange });
        permissionResults.heartRate = true;
      } catch (error) {
        console.warn('[GoogleHealthProvider] HeartRate permission verification failed:', error);
      }

      try {
        const basalResult = await readRecords('BasalMetabolicRate', { timeRangeFilter: testRange });
        permissionResults.basal = true;
      } catch (error) {
        console.warn('[GoogleHealthProvider] BasalMetabolicRate permission verification failed:', error);
      }

      try {
        const floorsResult = await readRecords('FloorsClimbed', { timeRangeFilter: testRange });
        permissionResults.floorsClimbed = true;
      } catch (error) {
        console.warn('[GoogleHealthProvider] FloorsClimbed permission verification failed:', error);
      }

      // Log the results for debugging
      console.log('[GoogleHealthProvider] Permission verification results:', permissionResults);

      // Consider permissions granted if at least 3 core permissions are available
      // This allows the app to function with partial permissions
      const grantedCount = Object.values(permissionResults).filter(Boolean).length;
      const hasMinimumPermissions = grantedCount >= 3;
      
      if (hasMinimumPermissions) {
        console.log('[GoogleHealthProvider] Minimum required permissions granted');
      } else {
        console.warn('[GoogleHealthProvider] Insufficient permissions granted');
      }
      
      return hasMinimumPermissions;
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

    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: normalizedStartDate.toISOString(),
      endTime: normalizedEndDate.toISOString(),
    };

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
              // Fetch steps with daily aggregation
              const stepsData = await this.fetchStepsWithDailyAggregation(
                normalizedStartDate,
                normalizedEndDate
              );
              rawData.steps = stepsData;
              break;

            case 'distance':
              // Fetch distance with daily aggregation
              const distanceData = await this.fetchDistanceWithDailyAggregation(
                normalizedStartDate,
                normalizedEndDate
              );
              rawData.distance = distanceData;
              break;

            case 'calories':
              // Fetch calories with daily aggregation
              const caloriesData = await this.fetchCaloriesWithDailyAggregation(
                normalizedStartDate,
                normalizedEndDate
              );
              rawData.calories = caloriesData;
              break;

            case 'heart_rate':
              // Fetch heart rate with daily aggregation
              const heartRateData = await this.fetchHeartRateWithDailyAggregation(
                normalizedStartDate,
                normalizedEndDate
              );
              rawData.heart_rate = heartRateData;
              break;

            case 'basal_calories':
              // Fetch basal metabolic rate with daily aggregation
              const basalData = await this.fetchBasalCaloriesWithDailyAggregation(
                normalizedStartDate,
                normalizedEndDate
              );
              rawData.basal_calories = basalData;
              break;

            case 'flights_climbed':
              // Fetch floors climbed with daily aggregation
              const floorsData = await this.fetchFloorsClimbedWithDailyAggregation(
                normalizedStartDate,
                normalizedEndDate
              );
              rawData.flights_climbed = floorsData;
              break;

            case 'exercise':
              // Fetch exercise time with daily aggregation
              const exerciseData = await this.fetchExerciseWithDailyAggregation(
                normalizedStartDate,
                normalizedEndDate
              );
              rawData.exercise = exerciseData;
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

  // New helper method to fetch steps with daily aggregation
  private async fetchStepsWithDailyAggregation(
    startDate: Date,
    endDate: Date
  ): Promise<RawHealthMetric[]> {
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };
    
    try {
      // Request step data
      const stepsResponse = await this.retryOperation(
        () => readRecords('Steps', { timeRangeFilter })
      );
      
      // Group data by day
      const dailyTotals = new Map<string, number>();
      
      (stepsResponse.records as StepsRecord[]).forEach(record => {
        const day = new Date(record.startTime).toISOString().split('T')[0];
        const currentTotal = dailyTotals.get(day) || 0;
        dailyTotals.set(day, currentTotal + record.count);
      });
      
      // Create a complete daily dataset including days with no data
      const result: RawHealthMetric[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayStart = DateUtils.getStartOfDay(new Date(currentDate));
        const dayEnd = DateUtils.getEndOfDay(new Date(currentDate));
        
        result.push({
          startDate: dayStart.toISOString(),
          endDate: dayEnd.toISOString(),
          value: dailyTotals.get(dateStr) || 0,
          unit: 'count',
          sourceBundle: 'com.google.android.apps.fitness'
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return result;
      
    } catch (error) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Error fetching steps with daily aggregation:', (error as Error).message);
      // In case of error, return empty array
      return [];
    }
  }

  // New helper method to fetch distance with daily aggregation
  private async fetchDistanceWithDailyAggregation(
    startDate: Date,
    endDate: Date
  ): Promise<RawHealthMetric[]> {
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };
    
    try {
      // Request distance data
      const distanceResponse = await this.retryOperation(
        () => readRecords('Distance', { timeRangeFilter })
      );
      
      // Group data by day (sum distances within each day)
      const dailyTotals = new Map<string, number>();
      
      (distanceResponse.records as DistanceRecord[]).forEach(record => {
        const day = new Date(record.startTime).toISOString().split('T')[0];
        const currentTotal = dailyTotals.get(day) || 0;
        dailyTotals.set(day, currentTotal + record.distance.inMeters);
      });
      
      // Create a complete daily dataset including days with no data
      const result: RawHealthMetric[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayStart = DateUtils.getStartOfDay(new Date(currentDate));
        const dayEnd = DateUtils.getEndOfDay(new Date(currentDate));
        
        result.push({
          startDate: dayStart.toISOString(),
          endDate: dayEnd.toISOString(),
          value: dailyTotals.get(dateStr) || 0,
          unit: 'meters',
          sourceBundle: 'com.google.android.apps.fitness'
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return result;
      
    } catch (error) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Error fetching distance with daily aggregation:', (error as Error).message);
      // In case of error, return empty array
      return [];
    }
  }

  // New helper method to fetch calories with daily aggregation
  private async fetchCaloriesWithDailyAggregation(
    startDate: Date,
    endDate: Date
  ): Promise<RawHealthMetric[]> {
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };
    
    try {
      // Request calories data
      const caloriesResponse = await this.retryOperation(
        () => readRecords('ActiveCaloriesBurned', { timeRangeFilter })
      );
      
      // Group data by day (sum calories within each day)
      const dailyTotals = new Map<string, number>();
      
      (caloriesResponse.records as CaloriesRecord[]).forEach(record => {
        if (!record.energy?.inKilocalories) return;
        
        const day = new Date(record.startTime).toISOString().split('T')[0];
        const currentTotal = dailyTotals.get(day) || 0;
        dailyTotals.set(day, currentTotal + record.energy.inKilocalories);
      });
      
      // Create a complete daily dataset including days with no data
      const result: RawHealthMetric[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayStart = DateUtils.getStartOfDay(new Date(currentDate));
        const dayEnd = DateUtils.getEndOfDay(new Date(currentDate));
        
        result.push({
          startDate: dayStart.toISOString(),
          endDate: dayEnd.toISOString(),
          value: Math.round(dailyTotals.get(dateStr) || 0),
          unit: 'kcal',
          sourceBundle: 'com.google.android.apps.fitness'
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return result;
      
    } catch (error) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Error fetching calories with daily aggregation:', (error as Error).message);
      // In case of error, return empty array
      return [];
    }
  }

  // New helper method to fetch heart rate with daily aggregation
  private async fetchHeartRateWithDailyAggregation(
    startDate: Date,
    endDate: Date
  ): Promise<RawHealthMetric[]> {
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };
    
    try {
      // Request heart rate data
      const heartRateResponse = await this.retryOperation(
        () => readRecords('HeartRate', { 
          timeRangeFilter,
          ascendingOrder: false,
          pageSize: 100
        })
      );
      
      // Group data by day and calculate average heart rate for each day
      const dailyHeartRates = new Map<string, number[]>();
      
      (heartRateResponse.records as HeartRateRecord[]).forEach(record => {
        // Filter valid heart rate samples
        const validSamples = record.samples
          .filter(sample => 
            typeof sample.beatsPerMinute === 'number' &&
            !isNaN(sample.beatsPerMinute) &&
            sample.beatsPerMinute > 30 &&
            sample.beatsPerMinute < 220
          )
          .map(sample => sample.beatsPerMinute);
        
        if (validSamples.length === 0) return;
        
        const day = new Date(record.startTime).toISOString().split('T')[0];
        
        if (!dailyHeartRates.has(day)) {
          dailyHeartRates.set(day, []);
        }
        
        // Add all valid samples to the day's array
        dailyHeartRates.get(day)!.push(...validSamples);
      });
      
      // Create a complete daily dataset including days with no data
      const result: RawHealthMetric[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayStart = DateUtils.getStartOfDay(new Date(currentDate));
        const dayEnd = DateUtils.getEndOfDay(new Date(currentDate));
        
        // Calculate average heart rate for the day
        let avgHeartRate = 0;
        const heartRates = dailyHeartRates.get(dateStr);
        
        if (heartRates && heartRates.length > 0) {
          // Calculate simple average
          avgHeartRate = heartRates.reduce((sum, val) => sum + val, 0) / heartRates.length;
        }
        
        result.push({
          startDate: dayStart.toISOString(),
          endDate: dayEnd.toISOString(),
          value: Math.round(avgHeartRate),
          unit: 'bpm',
          sourceBundle: 'com.google.android.apps.fitness'
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return result;
      
    } catch (error) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Error fetching heart rate with daily aggregation:', (error as Error).message);
      // In case of error, return empty array
      return [];
    }
  }

  // New helper method to fetch basal calories with daily aggregation
  private async fetchBasalCaloriesWithDailyAggregation(
    startDate: Date,
    endDate: Date
  ): Promise<RawHealthMetric[]> {
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };
    
    try {
      // Request basal metabolic rate data
      const hasPermission = await verifyHealthPermission(this, 'BasalMetabolicRate');
      if (!hasPermission) {
        logger.warn(LogCategory.Health, '[GoogleHealthProvider] BasalMetabolicRate permission not granted');
        return [];
      }
      
      const basalResponse = await this.retryOperation(
        () => readRecords('BasalMetabolicRate', { timeRangeFilter }),
        3,  // 3 retries
        1000  // 1 second delay
      );
      
      // Group data by day (average BMR values within each day)
      const dailyValues = new Map<string, number[]>();
      
      (basalResponse.records as unknown as BasalRecord[]).forEach(record => {
        if (!record.energy?.inKilocalories) return;
        
        const day = new Date(record.startTime).toISOString().split('T')[0];
        
        if (!dailyValues.has(day)) {
          dailyValues.set(day, []);
        }
        
        dailyValues.get(day)!.push(record.energy.inKilocalories);
      });
      
      // Create a complete daily dataset including days with no data
      const result: RawHealthMetric[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayStart = DateUtils.getStartOfDay(new Date(currentDate));
        const dayEnd = DateUtils.getEndOfDay(new Date(currentDate));
        
        // Calculate average BMR for the day
        let bmrValue = 0;
        const values = dailyValues.get(dateStr);
        
        if (values && values.length > 0) {
          // Use average for multiple values
          bmrValue = values.reduce((sum, val) => sum + val, 0) / values.length;
        }
        
        result.push({
          startDate: dayStart.toISOString(),
          endDate: dayEnd.toISOString(),
          value: Math.round(bmrValue),
          unit: 'kcal',
          sourceBundle: 'com.google.android.apps.fitness'
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return result;
      
    } catch (error) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Error fetching basal calories with daily aggregation:', (error as Error).message);
      // In case of error, return empty array
      return [];
    }
  }

  // New helper method to fetch exercise time with daily aggregation
  private async fetchExerciseWithDailyAggregation(
    startDate: Date,
    endDate: Date
  ): Promise<RawHealthMetric[]> {
    // Currently Google Health Connect doesn't have a direct equivalent for exercise time.
    // You could potentially use ExerciseSession records here in the future.
    return [];
  }

  // New helper method to fetch floors climbed with daily aggregation
  private async fetchFloorsClimbedWithDailyAggregation(
    startDate: Date,
    endDate: Date
  ): Promise<RawHealthMetric[]> {
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };
    
    try {
      // Request floors climbed data
      const floorsResponse = await this.retryOperation(
        () => readRecords('FloorsClimbed', { timeRangeFilter })
      );
      
      // Group data by day (sum floors within each day)
      const dailyTotals = new Map<string, number>();
      
      // Assuming the response format contains a 'floors' property
      (floorsResponse.records as any[]).forEach(record => {
        const day = new Date(record.startTime).toISOString().split('T')[0];
        const currentTotal = dailyTotals.get(day) || 0;
        dailyTotals.set(day, currentTotal + record.floors);
      });
      
      // Create a complete daily dataset including days with no data
      const result: RawHealthMetric[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayStart = DateUtils.getStartOfDay(new Date(currentDate));
        const dayEnd = DateUtils.getEndOfDay(new Date(currentDate));
        
        result.push({
          startDate: dayStart.toISOString(),
          endDate: dayEnd.toISOString(),
          value: dailyTotals.get(dateStr) || 0,
          unit: 'count',
          sourceBundle: 'com.google.android.apps.fitness'
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return result;
      
    } catch (error) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Error fetching floors climbed with daily aggregation:', (error as Error).message);
      // In case of error, return empty array
      return [];
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
