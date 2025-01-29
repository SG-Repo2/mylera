import { MetricType } from '../types/schemas';

// Define tracked metrics subset type
type TrackedMetricType = Extract<
  MetricType,
  'steps' | 'heart_rate' | 'calories' | 'distance'
>;

export const METRICS_CONFIG = {
  MAX_POINTS: 1000,
  POINTS_DISTRIBUTION: {
    steps: 165,    // Max points for steps
    heart_rate: 250, // Max points for heart rate
    calories: 188,   // Max points for calories
    distance: 160,   // Max points for distance
  } as const satisfies Record<TrackedMetricType, number>,
  
  GOALS: {
    steps: 10000,     // Daily step goal
    heart_rate: 100,  // Target heart rate
    calories: 600,    // Daily calorie burn goal
    distance: 5,      // Daily distance goal in km
  } as const satisfies Record<TrackedMetricType, number>
} as const;

// Type-safe validation function
export function validateMetricsConfig() {
  const totalPoints = Object.values(METRICS_CONFIG.POINTS_DISTRIBUTION)
    .reduce((sum, points) => sum + points, 0);
    
  if (totalPoints !== METRICS_CONFIG.MAX_POINTS) {
    throw new Error(
      `Invalid points distribution. Total (${totalPoints}) must equal MAX_POINTS (${METRICS_CONFIG.MAX_POINTS})`
    );
  }
}

// Utility function to calculate points for a specific metric
export function calculateMetricPoints(
  type: TrackedMetricType,
  value: number
): number {
  const maxPoints = METRICS_CONFIG.POINTS_DISTRIBUTION[type];
  const goal = METRICS_CONFIG.GOALS[type];
  
  return Math.min(Math.round((value / goal) * maxPoints), maxPoints);
}

// Function to check if a metric type is tracked
export function isTrackedMetric(
  type: MetricType
): type is TrackedMetricType {
  return type in METRICS_CONFIG.POINTS_DISTRIBUTION;
}

// Validate config at runtime
validateMetricsConfig();