import { promisify } from '../../../../utils/promiseWrapper';
import { logger, LogCategory } from '@/src/utils/logger';
import { TimestampedValue, AggregatorFunction } from './types';
import { RawHealthMetric } from '../../types/metrics';

/**
 * Group data by day and apply aggregator function to values
 * @param data Array of data points with timestamps
 * @param aggregator Function to combine values within same day (defaults to sum)
 * @returns Array of RawHealthMetric grouped by day
 */
export function groupDataByDay<T extends TimestampedValue>(
  data: T[],
  aggregator: AggregatorFunction = values => values.reduce((sum, v) => sum + v, 0),
  unit: string = 'count'
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
      unit,
      sourceBundle: 'com.apple.health',
    });
  });

  // Return sorted by date
  return result.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

/**
 * Retry an operation with exponential backoff
 * @param operation Function to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param initialDelay Initial delay in ms (default: 1000)
 * @returns Result of the operation
 */
export async function retryHealthKitOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(
          LogCategory.Health,
          `[AppleHealthProvider] Retry attempt ${attempt}/${maxRetries}`
        );
      }
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        logger.error(
          LogCategory.Health,
          `[AppleHealthProvider] All retry attempts failed: ${lastError.message}`
        );
        throw lastError;
      }

      const delay = initialDelay * Math.pow(2, attempt);
      logger.info(
        LogCategory.Health,
        `[AppleHealthProvider] Operation failed, retrying in ${delay}ms...`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Operation failed after retries');
}
