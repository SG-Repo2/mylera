import { logger, LogCategory } from './logger';
import type { DailyMetricScore, MetricType } from '../types/schemas';

/**
 * Utility to log point calculations consistently across the app
 * Helps with debugging point calculation issues
 */
export const pointsLogger = {
  /**
   * Log calculated points for a specific metric
   */
  logMetricPoints(
    metricType: MetricType, 
    value: number, 
    points: number, 
    goal: number, 
    source: string
  ) {
    logger.debug(
      LogCategory.Metrics, 
      `[${source}] Calculated points for ${metricType}`,
      undefined,
      undefined,
      {
        value,
        points,
        goal,
        goalReached: value >= goal
      }
    );
  },

  /**
   * Log total points calculation
   */
  logTotalPoints(
    metrics: DailyMetricScore[] | null, 
    totalPoints: number, 
    source: string
  ) {
    logger.debug(
      LogCategory.Metrics,
      `[${source}] Total points calculation`,
      undefined,
      undefined,
      {
        metricCount: metrics?.length || 0,
        totalPoints,
        breakdown: metrics?.map(m => ({
          type: m.metric_type,
          value: m.value,
          points: m.points
        })) || []
      }
    );
  },

  /**
   * Log database update for points
   */
  logDatabaseUpdate(
    userId: string,
    date: string,
    totalPoints: number,
    metricsCompleted: number,
    source: string
  ) {
    logger.info(
      LogCategory.Metrics,
      `[${source}] Updating database with points`,
      undefined,
      undefined,
      {
        userId,
        date,
        totalPoints,
        metricsCompleted
      }
    );
  },

  /**
   * Log UI display of points
   */
  logUiDisplay(
    componentName: string,
    userId: string,
    totalPoints: number
  ) {
    logger.debug(
      LogCategory.UI,
      `[${componentName}] Displaying points`,
      undefined,
      undefined,
      {
        userId: userId.slice(0, 8), // Only show partial ID for privacy
        totalPoints
      }
    );
  }
};
