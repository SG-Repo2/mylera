import type {
  MetricType,
  MetricUpdate,
  DailyMetricScore,
  MetricGoals,
  MetricValidationError
} from './schemas';

// Re-export types from schema definitions
export type {
  MetricType,
  MetricUpdate,
  DailyMetricScore,
  MetricGoals,
  MetricValidationError
};

// Additional type utilities and constants can be defined here if needed
export const METRIC_DISPLAY_NAMES: Record<MetricType, string> = {
  steps: 'Steps',
  distance: 'Distance',
  calories: 'Calories',
  heart_rate: 'Heart Rate',
  exercise: 'Exercise',
  standing: 'Standing'
} as const;

export const METRIC_DESCRIPTIONS: Record<MetricType, string> = {
  steps: 'Daily step count',
  distance: 'Distance traveled',
  calories: 'Active calories burned',
  heart_rate: 'Average heart rate',
  exercise: 'Exercise minutes',
  standing: 'Hours stood'
} as const;