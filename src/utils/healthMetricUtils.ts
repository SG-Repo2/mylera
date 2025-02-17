import type { NormalizedMetric } from '../providers/health/types/metrics';

/**
 * Transform raw health data into normalized metrics using a provided transform function
 */
export function normalizeMetric<T>(
  rawData: T[],
  transform: (raw: T) => NormalizedMetric
): NormalizedMetric[] {
  return rawData.map(transform);
}

/**
 * Aggregate normalized metrics based on their type
 * Returns null if no metrics are provided
 */
export function aggregateMetrics(metrics: NormalizedMetric[]): number {
  console.log('[healthMetricUtils] Aggregating metrics:', {
    metricCount: metrics.length,
    metricType: metrics[0]?.type,
    rawValues: metrics.map(m => m.value),
  });

  if (!metrics.length) {
    console.log('[healthMetricUtils] No metrics to aggregate, returning 0');
    return 0;
  }

  const metric = metrics[0];
  if (metric.type === 'heart_rate') {
    // Average for heart rate
    const sum = metrics.reduce((acc, m) => acc + (typeof m.value === 'number' ? m.value : 0), 0);
    const average = Math.round(sum / metrics.length);
    console.log('[healthMetricUtils] Heart rate average:', { sum, count: metrics.length, average });
    return average;
  }

  // Sum for other metrics
  const total = Math.round(
    metrics.reduce((acc, m) => acc + (typeof m.value === 'number' ? m.value : 0), 0)
  );
  console.log('[healthMetricUtils] Metric sum:', {
    type: metric.type,
    total,
    unit: metric.unit,
  });
  return total;
}

/**
 * Validate metric values based on type-specific rules
 * Returns true if the value is valid for the given metric type
 */
export function isValidMetricValue(value: number, type: string): boolean {
  if (__DEV__) {
    // Development: simple validation ensuring value is a valid number
    return typeof value === 'number' && !isNaN(value);
  }
  // Production validation
  switch (type) {
    case 'heart_rate':
      return value > 30 && value < 220; // Production range
    case 'distance':
      return value >= 0 && value < 100000; // Added upper bound for production safety
    case 'steps':
    case 'calories':
    case 'basal_calories':
    case 'flights_climbed':
    case 'exercise':
      return value >= 0;
    default:
      return typeof value === 'number' && !isNaN(value);
  }
}
