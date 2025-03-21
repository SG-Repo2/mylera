import AppleHealthKit, { HealthInputOptions } from 'react-native-health';
import { promisify } from '../../../../utils/promiseWrapper';
import { logger, LogCategory } from '@/src/utils/logger';
import { RawHealthMetric } from '../../types/metrics';
import { StepCountResult, DailySampleResult, HeartRateSample, SimpleValueResult } from './types';
import { retryHealthKitOperation } from './utils';

/**
 * Fetch raw step count data
 * @param options Health input options with time range
 * @returns Array of raw health metrics for steps
 */
export async function fetchStepsRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
  try {
    // Use getDailyStepCountSamples instead of getStepCount to get daily values
    const results = await retryHealthKitOperation(
      () => promisify<StepCountResult[]>(
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

/**
 * Fetch raw distance data
 * @param options Health input options with time range
 * @returns Array of raw health metrics for distance
 */
export async function fetchDistanceRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
  try {
    logger.debug(LogCategory.Health, '[AppleHealthProvider] Fetching distance with options:', undefined, undefined, options);
    
    // First, try daily samples API if available
    try {
      const dailyResults = await retryHealthKitOperation(
        () => promisify<DailySampleResult[]>(
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
    const results = await retryHealthKitOperation(
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

/**
 * Fetch raw calories data
 * @param options Health input options with time range
 * @returns Array of raw health metrics for calories
 */
export async function fetchCaloriesRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
  try {
    console.log('[AppleHealthProvider] Fetching calories with options:', options);
    
    // Use getActiveEnergyBurned which can return samples
    const results = await promisify<DailySampleResult[]>(
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

/**
 * Fetch raw basal calories data
 * @param options Health input options with time range
 * @returns Array of raw health metrics for basal calories
 */
export async function fetchBasalCaloriesRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
  try {
    const results = await promisify<SimpleValueResult>(
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
    logger.error(LogCategory.Health, '[AppleHealthProvider] Error reading basal calories:', 
      error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Fetch raw heart rate data
 * @param options Health input options with time range
 * @returns Array of raw health metrics for heart rate
 */
export async function fetchHeartRateRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
  try {
    // Use heart rate sample API with more samples and daily grouping
    const results = await promisify<HeartRateSample[]>(
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
    logger.error(LogCategory.Health, '[AppleHealthProvider] Error reading heart rate:', 
      error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Fetch raw flights climbed data
 * @param options Health input options with time range
 * @returns Array of raw health metrics for flights climbed
 */
export async function fetchFlightsClimbedRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
  try {
    const results = await promisify<SimpleValueResult>(
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
    logger.error(LogCategory.Health, '[AppleHealthProvider] Error reading flights climbed:', 
      error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Fetch raw exercise data
 * @param options Health input options with time range
 * @returns Array of raw health metrics for exercise
 */
export async function fetchExerciseRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
  try {
    const results = await promisify<SimpleValueResult>(
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
    logger.error(LogCategory.Health, '[AppleHealthProvider] Error reading exercise time:', 
      error instanceof Error ? error.message : String(error));
    return [];
  }
}
