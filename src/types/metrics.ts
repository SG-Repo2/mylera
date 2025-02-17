// Define the core MetricType type that matches healthMetrics config
export type MetricType =
  | 'steps'
  | 'distance'
  | 'calories'
  | 'heart_rate'
  | 'exercise'
  | 'basal_calories'
  | 'flights_climbed';

// Metric value types
export type MetricValue = number;

// Metric goal types
export type MetricGoal = number;

// Metric update payload
export interface MetricUpdate {
  value: MetricValue;
  timestamp?: string;
  unit?: string;
}

// Validation error type
export interface MetricValidationError {
  code: string;
  message: string;
  field?: string;
}
