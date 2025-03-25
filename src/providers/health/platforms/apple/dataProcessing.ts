import { NormalizedMetric, RawHealthData } from '../../types/metrics';
import { METRIC_UNITS } from '../../types/metrics';
import { MetricType } from '../../../../types/schemas';
import { logger, LogCategory } from '@/src/utils/logger';
import { aggregateMetrics } from '../../../../utils/healthMetricUtils';

/**
 * Normalize raw health data into standardized metrics
 * @param rawData Raw health data from HealthKit
 * @param type Type of metric to normalize
 * @returns Array of normalized metrics
 */
export function normalizeHealthKitMetrics(
  rawData: RawHealthData,
  type: MetricType
): NormalizedMetric[] {
  const metrics: NormalizedMetric[] = [];

  switch (type) {
    case 'steps':
      if (rawData.steps) {
        metrics.push(
          ...rawData.steps.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.STEPS,
            type,
          }))
        );
      }
      break;
    case 'distance':
      if (rawData.distance) {
        logger.debug(
          LogCategory.Health,
          '[AppleHealthProvider] Normalizing distance metrics:',
          undefined,
          undefined,
          {
            rawMetrics: rawData.distance,
            rawTotal: rawData.distance.reduce((sum, m) => sum + (m.value || 0), 0),
          }
        );

        const normalizedDistanceMetrics = rawData.distance.map(raw => ({
          timestamp: raw.endDate,
          value: Number(raw.value), // Keep in meters
          unit: METRIC_UNITS.DISTANCE,
          type,
        }));

        metrics.push(...normalizedDistanceMetrics);

        logger.debug(
          LogCategory.Health,
          '[AppleHealthProvider] Normalized distance metrics:',
          undefined,
          undefined,
          {
            normalizedMetrics: normalizedDistanceMetrics,
            normalizedTotal: normalizedDistanceMetrics.reduce((sum, m) => sum + m.value, 0),
          }
        );
      } else {
        logger.debug(LogCategory.Health, '[AppleHealthProvider] No distance data to normalize');
      }
      break;
    case 'calories':
      if (rawData.calories) {
        metrics.push(
          ...rawData.calories.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.CALORIES,
            type,
          }))
        );
      }
      break;
    case 'heart_rate':
      if (rawData.heart_rate) {
        metrics.push(
          ...rawData.heart_rate.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.HEART_RATE,
            type,
          }))
        );
      }
      break;
    case 'basal_calories':
      if (rawData.basal_calories) {
        metrics.push(
          ...rawData.basal_calories.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.CALORIES,
            type,
          }))
        );
      }
      break;
    case 'flights_climbed':
      if (rawData.flights_climbed) {
        metrics.push(
          ...rawData.flights_climbed.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.COUNT,
            type,
          }))
        );
      }
      break;
    case 'exercise':
      if (rawData.exercise) {
        metrics.push(
          ...rawData.exercise.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.EXERCISE,
            type,
          }))
        );
      }
      break;
  }

  return metrics;
}

/**
 * Aggregate normalized metrics into a single value
 * @param metrics Array of normalized metrics
 * @returns Aggregated value
 */
export function aggregateHealthKitMetric(metrics: NormalizedMetric[]): number {
  return aggregateMetrics(metrics);
}
