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
export function aggregateMetrics(metrics: NormalizedMetric[]): number | null {
  if (!metrics.length) return null;

  const metric = metrics[0];
  if (metric.type === 'heart_rate') {
    // Average for heart rate
    const sum = metrics.reduce((acc, m) => acc + (typeof m.value === 'number' ? m.value : 0), 0);
    return Math.round(sum / metrics.length);
  }
  
  // Sum for other metrics
  return Math.round(
    metrics.reduce((acc, m) => acc + (typeof m.value === 'number' ? m.value : 0), 0)
  );
}

/**
 * Validate metric values based on type-specific rules
 * Returns true if the value is valid for the given metric type
 */
export function isValidMetricValue(value: number, type: string): boolean {
  switch (type) {
    case 'heart_rate':
      return value > 30 && value < 220; // Reasonable heart rate range
    case 'steps':
    case 'distance':
    case 'calories':
    case 'basal_calories':
    case 'flights_climbed':
    case 'exercise':
      return value >= 0; // Non-negative values
    default:
      return true;
  }
}
