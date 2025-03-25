import type { DailyMetricScore, MetricType } from '../types/schemas';
import { calculatePoints } from './healthMetricUtils';
import { logger, LogCategory } from './logger';
import { pointsLogger } from './pointsLogger';

/**
 * Calculates total points for a collection of metrics using the same algorithm
 * as the metricsService, ensuring consistency across the application
 *
 * @param metrics - Array of daily metric scores
 * @param source - Source of the calculation for logging
 * @returns Total points calculated
 */
export function calculateTotalPoints(
  metrics: DailyMetricScore[],
  source: string = 'unknown'
): number {
  if (!metrics || !metrics.length) return 0;

  try {
    // Sum up the points field directly from the metrics, which is already
    // calculated by metricsService using the calculatePoints function
    const total = metrics.reduce((total, metric) => {
      // If points is already calculated, use that value
      if (typeof metric.points === 'number') {
        return total + metric.points;
      }

      // If we need to calculate points (e.g., for preview before saving)
      if (typeof metric.value === 'number' && metric.metric_type) {
        const goal = metric.goal || getDefaultGoalForMetric(metric.metric_type as MetricType);
        const { points } = calculatePoints(metric.value, metric.metric_type as MetricType, goal);

        // Log individual metric points calculation
        pointsLogger.logMetricPoints(
          metric.metric_type as MetricType,
          metric.value,
          points,
          goal,
          source
        );

        return total + points;
      }

      return total;
    }, 0);

    // Log the total points calculation
    pointsLogger.logTotalPoints(metrics, total, source);

    return total;
  } catch (error) {
    logger.error(LogCategory.Metrics, 'Error calculating total points:', (error as Error).message);
    return 0;
  }
}

/**
 * Gets default goal for a metric type if not specified
 */
function getDefaultGoalForMetric(metricType: MetricType): number {
  const defaultGoals: Record<MetricType, number> = {
    steps: 10000,
    distance: 5000,
    calories: 500,
    heart_rate: 75,
    exercise: 30,
    basal_calories: 1800,
    flights_climbed: 10,
  };

  return defaultGoals[metricType] || 0;
}
