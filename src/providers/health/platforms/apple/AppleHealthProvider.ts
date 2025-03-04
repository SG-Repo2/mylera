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
      // Use getDailyStepCountSamples instead of getStepCount to get daily values
      const results = await this.retryOperation(
        () => promisify<Array<{ 
          value: number; 
          startDate: string; 
          endDate: string;
          day?: string; // Some implementations include a day field
        }>>(
          AppleHealthKit.getDailyStepCountSamples, 
          options
        ),
        2,
        500
      );
      
      console.log('[AppleHealthProvider] Steps raw results:', results);
      
      if (!Array.isArray(results) || results.length === 0) {
        return [{
          startDate: options.startDate || new Date().toISOString(),
          endDate: options.endDate || new Date().toISOString(),
          value: 0,
          unit: 'count',
          sourceBundle: 'com.apple.health'
        }];
      }
      
      // If we receive a single value instead of daily samples, still create a daily entry
      if (results.length === 1 && !results[0].day) {
        const startDate = new Date(options.startDate || new Date());
        const endDate = new Date(options.endDate || new Date());
        const daySpan = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // For range queries, try to distribute the value across days
        if (daySpan > 1) {
          const samples = [];
          for (let i = 0; i < daySpan; i++) {
            const day = new Date(startDate);
            day.setDate(day.getDate() + i);
            samples.push({
              startDate: day.toISOString(),
              endDate: day.toISOString(),
              value: Math.round(results[0].value / daySpan),
              unit: 'count',
              sourceBundle: 'com.apple.health'
            });
          }
          return samples;
        }
      }
      
      // Process daily samples
      return results.map(sample => ({
        startDate: sample.startDate,
        endDate: sample.endDate,
        value: Math.round(sample.value || 0),
        unit: 'count',
        sourceBundle: 'com.apple.health'
      }));
    } catch (error) {
      logger.error(LogCategory.Health, '[AppleHealthProvider] Error reading steps:', (error as Error).message);
      return [];
    }
  }

  private async fetchDistanceRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    try {
      logger.debug(LogCategory.Health, '[AppleHealthProvider] Fetching distance with options:', undefined, undefined, options);
      
      // First, try daily samples API if available
      try {
        const dailyResults = await this.retryOperation(
          () => promisify<Array<{ value: number; startDate: string; endDate: string; }>>(
            AppleHealthKit.getDailyDistanceWalkingRunningSamples, 
            {
              ...options,
              interval: 24 * 60 * 60 * 1000, // 24-hour intervals (daily)
            }
          ),
          1, // Only try once, fall back to other method if this fails
          500
        );
        
        if (Array.isArray(dailyResults) && dailyResults.length > 0) {
          console.log('[AppleHealthProvider] Retrieved daily distance samples:', dailyResults);
          
          const mappedResults = dailyResults.map(sample => ({
            startDate: sample.startDate,
            endDate: sample.endDate,
            value: Math.round(sample.value || 0),
            unit: 'meters',
            sourceBundle: 'com.apple.health'
          }));
          
          return mappedResults;
        }
      } catch (dailyError) {
        console.warn('[AppleHealthProvider] Error using daily distance samples, falling back to standard API:', dailyError);
      }
      
      // Fall back to standard distance API
      const results = await this.retryOperation(
        () => promisify<any>(AppleHealthKit.getDistanceWalkingRunning, options),
        2, 
        500
      );
      
      // Handle different return formats
      if (results && typeof results === 'object' && typeof results.value === 'number') {
        // Create daily records by splitting the value across the date range
        const startDate = new Date(options.startDate || new Date());
        const endDate = new Date(options.endDate || new Date());
        const daySpan = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daySpan <= 1) {
          return [{
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            value: Math.round(results.value),
            unit: 'meters',
            sourceBundle: 'com.apple.health'
          }];
        }
        
        // Distribute the total across days for multi-day ranges
        const dailyValue = results.value / daySpan;
        const samples = [];
        
        for (let i = 0; i < daySpan; i++) {
          const dayDate = new Date(startDate);
          dayDate.setDate(dayDate.getDate() + i);
          const dayStart = new Date(dayDate);
          dayStart.setHours(0, 0, 0, 0);
          
          const dayEnd = new Date(dayDate);
          dayEnd.setHours(23, 59, 59, 999);
          
          samples.push({
            startDate: dayStart.toISOString(),
            endDate: dayEnd.toISOString(),
            value: Math.round(dailyValue),
            unit: 'meters',
            sourceBundle: 'com.apple.health'
          });
        }
        
        return samples;
      }
      
      // No valid results found, return empty data for the range
      const emptyResult = [{
        startDate: options.startDate || new Date().toISOString(),
        endDate: options.endDate || new Date().toISOString(),
        value: 0,
        unit: 'meters',
        sourceBundle: 'com.apple.health'
      }];
      
      console.log('[AppleHealthProvider] No valid distance data found, returning empty result');
      return emptyResult;
    } catch (error) {
      logger.error(LogCategory.Health, '[AppleHealthProvider] Error reading distance:', (error as Error).message);
      return [];
    }
  }

  private async fetchCaloriesRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    try {
      console.log('[AppleHealthProvider] Fetching calories with options:', options);
      
      // Use getActiveEnergyBurned which can return samples
      const results = await promisify<Array<{ value: number; startDate: string; endDate: string }>>(
        AppleHealthKit.getActiveEnergyBurned,
        {
          ...options,
          interval: 24 * 60 * 60 * 1000, // Get daily samples
        }
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

      // Group results by day to handle multiple entries per day
      const dailyTotals = new Map<string, number>();
      
      results.forEach(sample => {
        // Get the date portion (YYYY-MM-DD) from the timestamp
        const day = new Date(sample.startDate).toISOString().split('T')[0];
        const currentTotal = dailyTotals.get(day) || 0;
        dailyTotals.set(day, currentTotal + (sample.value || 0));
      });
      
      // Convert daily totals to array format
      const dailyResults: RawHealthMetric[] = [];
      
      dailyTotals.forEach((value, day) => {
        const date = new Date(day);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        dailyResults.push({
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
          value: Math.round(value),
          unit: 'kcal',
          sourceBundle: 'com.apple.health'
        });
      });
      
      return dailyResults;
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
      // Use heart rate sample API with more samples and daily grouping
      const results = await promisify<Array<{ value: number; startDate: string; endDate: string }>>(
        AppleHealthKit.getHeartRateSamples,
        {
          ...options,
          ascending: false,
          limit: 1000, // Get more samples for better accuracy
        }
      );

      // Filter out invalid readings
      const validSamples = results
        .filter(sample =>
          typeof sample.value === 'number' &&
          !isNaN(sample.value) &&
          sample.value > 30 && // More realistic minimum heart rate
          sample.value < 220 // Maximum realistic heart rate
        );

      if (validSamples.length === 0) {
        return [{
          startDate: options.startDate || new Date().toISOString(),
          endDate: options.endDate || new Date().toISOString(),
          value: 0,
          unit: 'bpm',
          sourceBundle: 'com.apple.health'
        }];
      }

      // Group by day and calculate daily averages
      const dailyReadings = new Map<string, number[]>();
      
      validSamples.forEach(sample => {
        const day = new Date(sample.startDate).toISOString().split('T')[0];
        if (!dailyReadings.has(day)) {
          dailyReadings.set(day, []);
        }
        dailyReadings.get(day)!.push(sample.value);
      });
      
      // Convert to daily averages
      const dailyAverages: RawHealthMetric[] = [];
      
      dailyReadings.forEach((readings, day) => {
        // Calculate average heart rate for the day
        // Recent readings get more weight
        const recentWeight = 0.6;
        const oldWeight = 0.4;
        let avgValue;
        
        if (readings.length <= 3) {
          // Simple average for few readings
          avgValue = readings.reduce((sum, val) => sum + val, 0) / readings.length;
        } else {
          // Weighted average giving more weight to recent readings
          const recentReadings = readings.slice(0, 3);
          const olderReadings = readings.slice(3);
          
          const recentAvg = recentReadings.reduce((sum, val) => sum + val, 0) / recentReadings.length;
          const olderAvg = olderReadings.reduce((sum, val) => sum + val, 0) / olderReadings.length;
          
          avgValue = (recentAvg * recentWeight) + (olderAvg * oldWeight);
        }
        
        const date = new Date(day);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        dailyAverages.push({
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
          value: Math.round(avgValue),
          unit: 'bpm',
          sourceBundle: 'com.apple.health'
        });
      });
      
      // Sort by date
      return dailyAverages.sort((a, b) => 
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );
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

  // Additional utility method for processing data by day
  private groupDataByDay<T extends { startDate: string; value: number }>(
    data: T[],
    aggregator: (values: number[]) => number = values => values.reduce((sum, v) => sum + v, 0)
  ): RawHealthMetric[] {
    const dailyData = new Map<string, number[]>();
    
    // Group values by day
    data.forEach(item => {
      const day = new Date(item.startDate).toISOString().split('T')[0];
      if (!dailyData.has(day)) {
        dailyData.set(day, []);
      }
      dailyData.get(day)!.push(item.value);
    });
    
    // Create a RawHealthMetric for each day
    const result: RawHealthMetric[] = [];
    
    dailyData.forEach((values, day) => {
      const date = new Date(day);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      result.push({
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
        value: aggregator(values),
        unit: this.getUnitForDay(day),
        sourceBundle: 'com.apple.health'
      });
    });
    
    // Return sorted by date
    return result.sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  }

  // Helper to get appropriate unit
  private getUnitForDay(day: string): string {
    return 'count'; // Override in subclasses if needed
  }
}
