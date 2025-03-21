import type { NormalizedMetric } from '../providers/health/types/metrics';
import { MetricType } from '../types/schemas';
import { logger, LogCategory } from './logger';

/**
 * Constants for metric validation
 */
export const METRIC_VALIDATION = {
  STEPS: {
    MIN: 0,
    MAX: 100000, // Reasonable upper limit for a day
  },
  DISTANCE: {
    MIN: 0,
    MAX: 100000, // 100km in meters
  },
  CALORIES: {
    MIN: 0,
    MAX: 10000, // Reasonable upper limit for active calories
  },
  HEART_RATE: {
    MIN: 30, // Minimum reasonable heart rate
    MAX: 220, // Maximum reasonable heart rate
  },
  EXERCISE: {
    MIN: 0,
    MAX: 1440, // Minutes in a day
  },
  BASAL_CALORIES: {
    MIN: 0,
    MAX: 5000, // Reasonable upper limit for basal calories
  },
  FLIGHTS_CLIMBED: {
    MIN: 0,
    MAX: 1000, // Reasonable upper limit
  },
};

/**
 * Transform raw health data into normalized metrics using a provided transform function
 * @param rawData - Array of raw data points
 * @param transform - Function to transform each raw data point
 * @returns Array of normalized metrics
 */
export function normalizeMetric<T>(
  rawData: T[],
  transform: (raw: T) => NormalizedMetric
): NormalizedMetric[] {
  if (!rawData || rawData.length === 0) {
    return [];
  }
  
  try {
    const metrics = rawData.map(transform);
    
    // Filter out invalid metrics
    const validMetrics = metrics.filter(metric => {
      const isValid = isValidMetricValue(metric.value, metric.type);
      if (!isValid) {
        logger.warn(LogCategory.Health, `[healthMetricUtils] Filtering out invalid ${metric.type} value: ${metric.value}`);
      }
      return isValid;
    });
    
    return validMetrics;
  } catch (error) {
    logger.error(LogCategory.Health, '[healthMetricUtils] Error normalizing metrics:', (error as Error).message);
    return [];
  }
}

/**
 * Aggregate normalized metrics based on their type
 * @param metrics - Array of normalized metrics to aggregate
 * @returns Aggregated value or 0 if no metrics provided
 */
export function aggregateMetrics(metrics: NormalizedMetric[]): number {
  try {
    if (!metrics.length) {
      logger.debug(LogCategory.Health, '[healthMetricUtils] No metrics to aggregate, returning 0');
      return 0;
    }

    logger.debug(LogCategory.Health, `[healthMetricUtils] Aggregating metrics: ${JSON.stringify({
      metricCount: metrics.length,
      metricType: metrics[0]?.type,
      rawValues: metrics.map(m => m.value)
    })}`);

    const metric = metrics[0];
    
    // Apply different aggregation strategies based on metric type
    if (metric.type === 'heart_rate') {
      // Average for heart rate (takes the most recent readings with more weight)
      const validHeartRates = metrics
        .filter(m => typeof m.value === 'number' && m.value >= METRIC_VALIDATION.HEART_RATE.MIN && m.value <= METRIC_VALIDATION.HEART_RATE.MAX)
        .map(m => ({ value: m.value, timestamp: new Date(m.timestamp).getTime() }))
        .sort((a, b) => b.timestamp - a.timestamp); // Sort descending by timestamp
      
      if (validHeartRates.length === 0) {
        return 0;
      }
      
      // Take weighted average, more recent readings have more weight
      // Most recent 3 readings get 60% of the weight, the rest 40%
      if (validHeartRates.length <= 3) {
        const sum = validHeartRates.reduce((acc, hr) => acc + hr.value, 0);
        return Math.round(sum / validHeartRates.length);
      } else {
        const recentReadings = validHeartRates.slice(0, 3);
        const olderReadings = validHeartRates.slice(3);
        
        const recentAvg = recentReadings.reduce((acc, hr) => acc + hr.value, 0) / recentReadings.length;
        const olderAvg = olderReadings.reduce((acc, hr) => acc + hr.value, 0) / olderReadings.length;
        
        const weightedAvg = (recentAvg * 0.6) + (olderAvg * 0.4);
        
        logger.debug(LogCategory.Health, '[healthMetricUtils] Heart rate weighted average:', undefined, undefined, { 
          recentAvg, 
          olderAvg, 
          weightedAvg, 
          rounded: Math.round(weightedAvg) 
        });
        
        return Math.round(weightedAvg);
      }
    }
    
    // For other metrics, sum all valid values
    const validMetrics = metrics.filter(m => isValidMetricValue(m.value, metric.type));
    const total = Math.round(
      validMetrics.reduce((acc, m) => acc + (typeof m.value === 'number' ? m.value : 0), 0)
    );
    
    logger.debug(LogCategory.Health, '[healthMetricUtils] Metric sum:', undefined, undefined, {
      type: metric.type,
      total,
      unit: metric.unit
    });
    
    return total;
  } catch (error) {
    logger.error(LogCategory.Health, '[healthMetricUtils] Error aggregating metrics:', (error as Error).message);
    return 0;
  }
}

/**
 * Calculate points for a metric value based on its goal
 * @param value - The metric value
 * @param type - The metric type
 * @param goal - The goal value
 * @returns Object containing points and goal reached status
 */
export function calculatePoints(
  value: number, 
  type: MetricType,
  goal: number
): { points: number; goalReached: boolean } {
  if (!isValidMetricValue(value, type)) {
    return { points: 0, goalReached: false };
  }
  
  // Default result
  let points = 0;
  let goalReached = false;
  
  try {
    switch (type) {
      case 'steps':
        // 1 point per 100 steps, max 100 points
        points = Math.min(Math.floor(value / 100), 100);
        goalReached = value >= goal;
        break;
        
      case 'distance':
        // Calculate points based on distance in meters
        // 1 point per 160.934 meters (0.1 miles), max 30 points
        // This ensures consistent scoring regardless of measurement system
        points = Math.min(Math.floor(value / 160.934), 30);
        goalReached = value >= goal;
        break;
        
      case 'calories':
        // 1 point per 10 calories, max 50 points
        points = Math.min(Math.floor(value / 10), 50);
        goalReached = value >= goal;
        break;
        
      case 'heart_rate':
        // For heart rate, we want to be in a target zone
        // ±15 from goal is considered ideal
        const minIdeal = goal - 15;
        const maxIdeal = goal + 15;
        
        if (value >= minIdeal && value <= maxIdeal) {
          // Full points if in ideal range
          points = 30;
          goalReached = true;
        } else {
          // Partial points based on how far from ideal range
          const distFromIdeal = value < minIdeal
            ? minIdeal - value
            : value - maxIdeal;
          
          // Linearly decrease points as we get further from ideal range
          // No points if 30+ bpm away from ideal range
          points = Math.max(30 - Math.floor(distFromIdeal), 0);
          goalReached = points > 15; // Consider goal reached if at least half points
        }
        break;
        
      case 'exercise':
        // 1 point per minute, max 30 points
        points = Math.min(Math.floor(value), 30);
        goalReached = value >= goal;
        break;
        
      case 'basal_calories':
        // This is more of a baseline metric, less about exceeding a goal
        // 1 point per 20 calories, max 90 points
        points = Math.min(Math.floor(value / 20), 90);
        // Goal reached if within 10% of goal (either direction)
        goalReached = value >= goal * 0.9 && value <= goal * 1.1;
        break;
        
      case 'flights_climbed':
        // 2 points per flight, max 20 points
        points = Math.min(Math.floor(value * 2), 20);
        goalReached = value >= goal;
        break;
        
      default:
        // For unknown metrics, use percentage of goal
        points = Math.min(Math.floor((value / goal) * 100), 100);
        goalReached = value >= goal;
    }
    
    logger.debug(LogCategory.Health, '[healthMetricUtils] Calculated points:', undefined, undefined, {
      type,
      value,
      goal,
      points,
      goalReached
    });
    
    return { points, goalReached };
  } catch (error) {
    logger.error(LogCategory.Health, '[healthMetricUtils] Error calculating points:', (error as Error).message);
    return { points: 0, goalReached: false };
  }
}

/**
 * Calculate an overall health score from multiple metrics
 * @param metrics - Object mapping metric types to values
 * @param weights - Optional custom weights for each metric (1 by default)
 * @returns Overall health score (0-100)
 */
export function calculateHealthScore(
  metrics: Record<MetricType, number | null>,
  weights: Partial<Record<MetricType, number>> = {}
): number {
  // Default weights if not provided
  const defaultWeights: Record<MetricType, number> = {
    steps: 1,
    distance: 1,
    calories: 1,
    heart_rate: 1,
    exercise: 1,
    basal_calories: 0.5,  // Less weight for basal metrics
    flights_climbed: 0.5  // Less weight for flights climbed
  };
  
  const finalWeights = { ...defaultWeights, ...weights };
  let totalWeight = 0;
  let weightedSum = 0;
  
  // Process each valid metric
  Object.entries(metrics).forEach(([type, value]) => {
    if (value === null || value === undefined) return;
    
    const metricType = type as MetricType;
    if (!isValidMetricValue(value, metricType)) return;
    
    // Get metric config
    const weight = finalWeights[metricType] || 0;
    if (weight <= 0) return;
    
    totalWeight += weight;
    
    // Get preconfigured goals from config
    // For now, just use some reasonable defaults
    const goals: Record<MetricType, number> = {
      steps: 10000,
      distance: 5000,  // 5km in meters
      calories: 500,
      heart_rate: 75,
      exercise: 30,
      basal_calories: 1800,
      flights_climbed: 10
    };
    
    const { points } = calculatePoints(value, metricType, goals[metricType]);
    weightedSum += points * weight;
  });
  
  // Avoid division by zero
  if (totalWeight === 0) {
    return 0;
  }
  
  // Calculate final score (0-100)
  const score = Math.round(weightedSum / totalWeight);
  
  logger.debug(LogCategory.Health, '[healthMetricUtils] Calculated health score:', undefined, undefined, { score });
  
  return Math.min(Math.max(score, 0), 100);  // Ensure score is between 0-100
}

/**
 * Validate metric values based on type-specific rules
 * @param value - The metric value to validate
 * @param type - The metric type
 * @returns true if the value is valid for the given metric type
 */
export function isValidMetricValue(value: number, type: string): boolean {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return false;
  }
  
  switch (type) {
    case 'steps':
      return value >= 0 && value <= METRIC_VALIDATION.STEPS.MAX;
    case 'distance':
      return value >= 0 && value <= METRIC_VALIDATION.DISTANCE.MAX;
    case 'calories':
      return value >= 0 && value <= METRIC_VALIDATION.CALORIES.MAX;
    case 'heart_rate':
      return value >= METRIC_VALIDATION.HEART_RATE.MIN && value <= METRIC_VALIDATION.HEART_RATE.MAX;
    case 'exercise':
      return value >= 0 && value <= METRIC_VALIDATION.EXERCISE.MAX;
    case 'basal_calories':
      return value >= 0 && value <= METRIC_VALIDATION.BASAL_CALORIES.MAX;
    case 'flights_climbed':
      return value >= 0 && value <= METRIC_VALIDATION.FLIGHTS_CLIMBED.MAX;
    default:
      return value >= 0;
  }
}