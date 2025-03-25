import { readRecords } from 'react-native-health-connect';
import { logger, LogCategory } from '@/src/utils/logger';
import { DateUtils } from '../../../../utils/DateUtils';
import { METRIC_UNITS } from '../../types/metrics';
import { RawHealthMetric } from '../../types/metrics';
import { retryOperation } from './utils';
import { verifyHealthPermission } from '../../../../utils/healthPermissionUtils';
import {
  StepsRecord,
  DistanceRecord,
  CaloriesRecord,
  BasalRecord,
  HeartRateRecord,
  ExerciseSessionRecord,
  TimeRangeFilter,
} from './types';

export async function fetchStepsWithDailyAggregation(
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  try {
    const stepsResponse = await retryOperation(() => readRecords('Steps', { timeRangeFilter }));

    const dailyTotals = new Map<string, number>();

    (stepsResponse.records as StepsRecord[]).forEach(record => {
      const day = new Date(record.startTime).toISOString().split('T')[0];
      const currentTotal = dailyTotals.get(day) || 0;
      dailyTotals.set(day, currentTotal + record.count);
    });

    return createDailyMetrics(startDate, endDate, dailyTotals, 'count');
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[GoogleHealthProvider] Error fetching steps:',
      (error as Error).message
    );
    return [];
  }
}

export async function fetchDistanceWithDailyAggregation(
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  try {
    const distanceResponse = await retryOperation(() =>
      readRecords('Distance', { timeRangeFilter })
    );

    const dailyTotals = new Map<string, number>();

    (distanceResponse.records as DistanceRecord[]).forEach(record => {
      const day = new Date(record.startTime).toISOString().split('T')[0];
      const currentTotal = dailyTotals.get(day) || 0;
      dailyTotals.set(day, currentTotal + record.distance.inMeters);
    });

    return createDailyMetrics(startDate, endDate, dailyTotals, 'meters');
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[GoogleHealthProvider] Error fetching distance:',
      (error as Error).message
    );
    return [];
  }
}

export async function fetchCaloriesWithDailyAggregation(
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  try {
    const caloriesResponse = await retryOperation(() =>
      readRecords('ActiveCaloriesBurned', { timeRangeFilter })
    );

    const dailyTotals = new Map<string, number>();

    (caloriesResponse.records as CaloriesRecord[]).forEach(record => {
      if (!record.energy?.inKilocalories) return;

      const day = new Date(record.startTime).toISOString().split('T')[0];
      const currentTotal = dailyTotals.get(day) || 0;
      dailyTotals.set(day, currentTotal + record.energy.inKilocalories);
    });

    return createDailyMetrics(startDate, endDate, dailyTotals, 'kcal');
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[GoogleHealthProvider] Error fetching calories:',
      (error as Error).message
    );
    return [];
  }
}

export async function fetchHeartRateWithDailyAggregation(
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  try {
    const heartRateResponse = await retryOperation(() =>
      readRecords('HeartRate', { timeRangeFilter })
    );

    const dailyHeartRates = new Map<string, number[]>();

    (heartRateResponse.records as HeartRateRecord[]).forEach(record => {
      const validSamples = record.samples
        .filter(sample => {
          const isValid =
            typeof sample.beatsPerMinute === 'number' &&
            !isNaN(sample.beatsPerMinute) &&
            sample.beatsPerMinute > 30 &&
            sample.beatsPerMinute < 220;

          if (!isValid) {
            logger.warn(
              LogCategory.Health,
              '[GoogleHealthProvider] Invalid heart rate sample:',
              JSON.stringify(sample)
            );
          }

          return isValid;
        })
        .map(sample => sample.beatsPerMinute);

      if (validSamples.length === 0) return;

      const day = new Date(record.startTime).toISOString().split('T')[0];

      if (!dailyHeartRates.has(day)) {
        dailyHeartRates.set(day, []);
      }

      dailyHeartRates.get(day)!.push(...validSamples);
    });

    const dailyAverages = new Map<string, number>();

    dailyHeartRates.forEach((rates, day) => {
      // Sort readings by timestamp (most recent first)
      const sortedRates = [...rates].sort((a, b) => b - a);

      if (sortedRates.length <= 3) {
        // For 3 or fewer readings, use simple average
        const average = sortedRates.reduce((sum, val) => sum + val, 0) / sortedRates.length;
        dailyAverages.set(day, Math.round(average));
      } else {
        // Use weighted average with more recent readings weighted higher
        const recentReadings = sortedRates.slice(0, 3);
        const olderReadings = sortedRates.slice(3);

        const recentAvg = recentReadings.reduce((sum, val) => sum + val, 0) / recentReadings.length;
        const olderAvg = olderReadings.reduce((sum, val) => sum + val, 0) / olderReadings.length;

        // 60% weight to recent readings, 40% to older readings
        const weightedAvg = recentAvg * 0.6 + olderAvg * 0.4;

        logger.debug(
          LogCategory.Health,
          '[GoogleHealthProvider] Heart rate weighted average:',
          undefined,
          undefined,
          {
            recentAvg,
            olderAvg,
            weightedAvg,
            rounded: Math.round(weightedAvg),
          }
        );

        dailyAverages.set(day, Math.round(weightedAvg));
      }
    });

    return createDailyMetrics(startDate, endDate, dailyAverages, 'bpm');
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[GoogleHealthProvider] Error fetching heart rate:',
      (error as Error).message
    );
    return [];
  }
}

export async function fetchBasalCaloriesWithDailyAggregation(
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  try {
    const basalResponse = await retryOperation(() =>
      readRecords('BasalMetabolicRate', { timeRangeFilter })
    );

    const dailyValues = new Map<string, number[]>();

    (basalResponse.records as unknown as BasalRecord[]).forEach(record => {
      const day = new Date(record.startTime).toISOString().split('T')[0];

      if (!dailyValues.has(day)) {
        dailyValues.set(day, []);
      }

      dailyValues.get(day)!.push(record.energy.inKilocalories);
    });

    const dailyAverages = new Map<string, number>();

    dailyValues.forEach((values, day) => {
      if (values.length > 0) {
        const average = values.reduce((sum, val) => sum + val, 0) / values.length;
        dailyAverages.set(day, Math.round(average));
      }
    });

    return createDailyMetrics(startDate, endDate, dailyAverages, 'kcal');
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[GoogleHealthProvider] Error fetching basal calories:',
      (error as Error).message
    );
    return [];
  }
}

export async function fetchExerciseWithDailyAggregation(
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  try {
    const exerciseResponse = await retryOperation(() =>
      readRecords('ExerciseSession', { timeRangeFilter })
    );

    const dailyDurations = new Map<string, number>();

    (exerciseResponse.records as ExerciseSessionRecord[]).forEach(record => {
      const startDateTime = new Date(record.startTime);
      const endDateTime = new Date(record.endTime);
      const durationMinutes = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60);
      const dateKey = DateUtils.getLocalDateString(startDateTime);

      const currentDuration = dailyDurations.get(dateKey) || 0;
      dailyDurations.set(dateKey, currentDuration + durationMinutes);
    });

    return createDailyMetrics(startDate, endDate, dailyDurations, METRIC_UNITS.EXERCISE);
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[GoogleHealthProvider] Error fetching exercise:',
      (error as Error).message
    );
    return [];
  }
}

export async function fetchFloorsClimbedWithDailyAggregation(
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  const timeRangeFilter: TimeRangeFilter = {
    operator: 'between',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
  };

  try {
    const floorsResponse = await retryOperation(() =>
      readRecords('FloorsClimbed', { timeRangeFilter })
    );

    const dailyTotals = new Map<string, number>();

    (floorsResponse.records || []).forEach(record => {
      const day = new Date(record.startTime).toISOString().split('T')[0];
      const currentTotal = dailyTotals.get(day) || 0;
      const floorCount = record.floors || 0;
      dailyTotals.set(day, currentTotal + floorCount);
    });

    return createDailyMetrics(startDate, endDate, dailyTotals, 'count');
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[GoogleHealthProvider] Error fetching floors climbed:',
      (error as Error).message
    );
    return [];
  }
}

function createDailyMetrics(
  startDate: Date,
  endDate: Date,
  dailyValues: Map<string, number>,
  unit: string
): RawHealthMetric[] {
  const result: RawHealthMetric[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayStart = DateUtils.getStartOfDay(new Date(currentDate));
    const dayEnd = DateUtils.getEndOfDay(new Date(currentDate));

    result.push({
      startDate: dayStart.toISOString(),
      endDate: dayEnd.toISOString(),
      value: dailyValues.get(dateStr) || 0,
      unit,
      sourceBundle: 'com.google.android.apps.fitness',
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}
