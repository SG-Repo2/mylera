import { DateUtils } from '../../../../utils/DateUtils';
import { logger, LogCategory } from '@/src/utils/logger';
import { FitbitActivity, FitbitStorageKeys } from './types';
import { RawHealthMetric } from '../../types/metrics';

export const STORAGE_KEYS: FitbitStorageKeys = {
  ACCESS_TOKEN: 'fitbit_access_token',
  REFRESH_TOKEN: 'fitbit_refresh_token',
  TOKEN_EXPIRY: 'fitbit_token_expiry',
  LAST_SYNC: 'fitbit_last_sync',
};

export function generateDayRange(startDate: Date, endDate: Date): string[] {
  const days: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    days.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function formatFitbitDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function createRawHealthMetric(date: string, value: number, unit: string): RawHealthMetric {
  return {
    startDate: `${date}T00:00:00.000Z`,
    endDate: `${date}T23:59:59.999Z`,
    value,
    unit,
    sourceBundle: 'com.fitbit.api',
  };
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries) break;

      const delay = initialDelay * Math.pow(2, attempt - 1);
      logger.warn(
        LogCategory.Health,
        `[FitbitHealthProvider] Operation failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`,
        lastError.message
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function validateHeartRate(heartRate: number): boolean {
  return typeof heartRate === 'number' && !isNaN(heartRate) && heartRate > 30 && heartRate < 220;
}

export function calculateExerciseMinutes(activities: FitbitActivity[]): number {
  return activities.reduce((total, activity) => {
    if (
      activity.activityLevel &&
      ['moderate', 'vigorous', 'very vigorous'].includes(activity.activityLevel.toLowerCase())
    ) {
      return total + activity.duration / 60000; // Convert from ms to minutes
    }
    return total;
  }, 0);
}

export function estimateFlightsFromElevation(elevationMeters: number): number {
  // Roughly 3 meters per flight
  return Math.round(elevationMeters / 3);
}
