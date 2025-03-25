import { logger, LogCategory } from '@/src/utils/logger';
import { METRIC_UNITS } from '../../types/metrics';
import { RawHealthMetric } from '../../types/metrics';
import { retryOperation } from './utils';
import {
  FitbitStepsData,
  FitbitDistanceData,
  FitbitCaloriesData,
  FitbitHeartRateData,
  FitbitElevationData,
  FitbitActivitiesData,
} from './types';
import {
  createRawHealthMetric,
  generateDayRange,
  validateHeartRate,
  calculateExerciseMinutes,
  estimateFlightsFromElevation,
} from './utils';

export async function fetchStepsWithDailyAggregation(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  try {
    const url = `https://api.fitbit.com/1/user/-/activities/steps/date/${startDateStr}/${endDateStr}.json`;
    const data = (await retryOperation(() => fetchFromFitbit(accessToken, url))) as FitbitStepsData;

    if (data && data['activities-steps'] && data['activities-steps'].length > 0) {
      return data['activities-steps'].map(item =>
        createRawHealthMetric(item.dateTime, Number(item.value), 'count')
      );
    }

    return [];
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[FitbitHealthProvider] Error fetching steps:',
      (error as Error).message
    );
    return [];
  }
}

export async function fetchDistanceWithDailyAggregation(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  try {
    const url = `https://api.fitbit.com/1/user/-/activities/distance/date/${startDateStr}/${endDateStr}.json`;
    const data = (await retryOperation(() =>
      fetchFromFitbit(accessToken, url)
    )) as FitbitDistanceData;

    if (data && data['activities-distance'] && data['activities-distance'].length > 0) {
      return data['activities-distance'].map(item => {
        // Fitbit distance is in kilometers, convert to meters
        const distanceMeters = Number(item.value) * 1000;
        return createRawHealthMetric(item.dateTime, distanceMeters, METRIC_UNITS.DISTANCE);
      });
    }

    return [];
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[FitbitHealthProvider] Error fetching distance:',
      (error as Error).message
    );
    return [];
  }
}

export async function fetchCaloriesWithDailyAggregation(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  try {
    const url = `https://api.fitbit.com/1/user/-/activities/calories/date/${startDateStr}/${endDateStr}.json`;
    const data = (await retryOperation(() =>
      fetchFromFitbit(accessToken, url)
    )) as FitbitCaloriesData;

    if (data && data['activities-calories'] && data['activities-calories'].length > 0) {
      return data['activities-calories'].map(item =>
        createRawHealthMetric(item.dateTime, Number(item.value), METRIC_UNITS.CALORIES)
      );
    }

    return [];
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[FitbitHealthProvider] Error fetching calories:',
      (error as Error).message
    );
    return [];
  }
}

export async function fetchHeartRateWithDailyAggregation(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  try {
    const result: RawHealthMetric[] = [];
    const dateRange = generateDayRange(startDate, endDate);

    for (const date of dateRange) {
      try {
        const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d.json`;
        const data = (await retryOperation(() =>
          fetchFromFitbit(accessToken, url)
        )) as FitbitHeartRateData;

        if (data && data['activities-heart'] && data['activities-heart'].length > 0) {
          data['activities-heart'].forEach(item => {
            if (item.value.restingHeartRate && validateHeartRate(item.value.restingHeartRate)) {
              result.push(
                createRawHealthMetric(
                  item.dateTime,
                  item.value.restingHeartRate,
                  METRIC_UNITS.HEART_RATE
                )
              );
            }
          });
        }
      } catch (innerError) {
        logger.warn(
          LogCategory.Health,
          `[FitbitHealthProvider] Error fetching heart rate for date ${date}:`,
          innerError instanceof Error ? innerError.message : 'Unknown error'
        );
      }
    }

    return result;
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[FitbitHealthProvider] Error in heart rate range fetch:',
      (error as Error).message
    );
    return [];
  }
}

export async function fetchBasalCaloriesWithDailyAggregation(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  try {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const url = `https://api.fitbit.com/1/user/-/activities/date/${startDateStr}/${endDateStr}.json`;

    const data = await retryOperation(() => fetchFromFitbit(accessToken, url));
    const dateRange = generateDayRange(startDate, endDate);

    return dateRange.map(date => {
      const dayData = data.find((day: any) => day.dateTime === date);
      const basalCalories = dayData?.summary?.caloriesBMR || 0;

      return createRawHealthMetric(date, Number(basalCalories), METRIC_UNITS.CALORIES);
    });
  } catch (error) {
    logger.warn(
      LogCategory.Health,
      '[FitbitHealthProvider] Error or unsupported basal calories:',
      error instanceof Error ? error.message : 'Unknown error'
    );

    // Generate placeholder entries
    const dateRange = generateDayRange(startDate, endDate);
    return dateRange.map(date => createRawHealthMetric(date, 0, METRIC_UNITS.CALORIES));
  }
}

export async function fetchFlightsClimbedWithDailyAggregation(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  try {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const url = `https://api.fitbit.com/1/user/-/activities/elevation/date/${startDateStr}/${endDateStr}.json`;

    const data = (await retryOperation(() =>
      fetchFromFitbit(accessToken, url)
    )) as FitbitElevationData;

    if (data && data['activities-elevation'] && data['activities-elevation'].length > 0) {
      return data['activities-elevation'].map(item => {
        const elevationMeters = Number(item.value);
        const estimatedFlights = estimateFlightsFromElevation(elevationMeters);
        return createRawHealthMetric(item.dateTime, estimatedFlights, METRIC_UNITS.COUNT);
      });
    }

    // Generate placeholder entries if no data
    const dateRange = generateDayRange(startDate, endDate);
    return dateRange.map(date => createRawHealthMetric(date, 0, METRIC_UNITS.COUNT));
  } catch (error) {
    logger.warn(
      LogCategory.Health,
      '[FitbitHealthProvider] Error fetching flights climbed:',
      error instanceof Error ? error.message : 'Unknown error'
    );

    // Generate placeholder entries
    const dateRange = generateDayRange(startDate, endDate);
    return dateRange.map(date => createRawHealthMetric(date, 0, METRIC_UNITS.COUNT));
  }
}

export async function fetchExerciseWithDailyAggregation(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<RawHealthMetric[]> {
  try {
    const result: RawHealthMetric[] = [];
    const dateRange = generateDayRange(startDate, endDate);

    for (const date of dateRange) {
      try {
        const url = `https://api.fitbit.com/1/user/-/activities/date/${date}.json`;
        const data = (await retryOperation(() =>
          fetchFromFitbit(accessToken, url)
        )) as FitbitActivitiesData;

        if (data && data.activities && Array.isArray(data.activities)) {
          const exerciseMinutes = calculateExerciseMinutes(data.activities);
          result.push(createRawHealthMetric(date, exerciseMinutes, METRIC_UNITS.EXERCISE));
        }
      } catch (dayError) {
        logger.warn(
          LogCategory.Health,
          `[FitbitHealthProvider] Error fetching exercise for date ${date}:`,
          dayError instanceof Error ? dayError.message : 'Unknown error'
        );
        result.push(createRawHealthMetric(date, 0, METRIC_UNITS.EXERCISE));
      }
    }

    return result;
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[FitbitHealthProvider] Error fetching exercise range:',
      (error as Error).message
    );
    const dateRange = generateDayRange(startDate, endDate);
    return dateRange.map(date => createRawHealthMetric(date, 0, METRIC_UNITS.EXERCISE));
  }
}

async function fetchFromFitbit(accessToken: string, url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Fitbit API error: ${response.status}`);
  }

  return response.json();
}
