import { MetricType } from '../types/metrics';

// Define supported measurement systems
export type MeasurementSystem = 'metric' | 'imperial';

// Define conversion factors
const CONVERSION_FACTORS = {
  METERS_TO_MILES: 1 / 1609.34,
  METERS_TO_FEET: 3.28084,
  KM_TO_MILES: 0.621371,
  KG_TO_LBS: 2.20462,
  KCAL_TO_KJ: 4.184,
} as const;

// Define display units for each system
export const DISPLAY_UNITS: Record<MetricType, Record<MeasurementSystem, string>> = {
  steps: {
    metric: 'steps',
    imperial: 'steps',
  },
  distance: {
    metric: 'km',
    imperial: 'mi',
  },
  calories: {
    metric: 'kcal',
    imperial: 'kcal',
  },
  heart_rate: {
    metric: 'bpm',
    imperial: 'bpm',
  },
  exercise: {
    metric: 'min',
    imperial: 'min',
  },
  basal_calories: {
    metric: 'kcal',
    imperial: 'kcal',
  },
  flights_climbed: {
    metric: 'floors',
    imperial: 'floors',
  },
};

// Interface for formatted metric values
export interface FormattedMetric {
  value: number;
  unit: string;
}

/**
 * Converts a metric value to the user's preferred measurement system.
 */
export function convertMetricValue(
  value: number,
  metricType: MetricType,
  system: MeasurementSystem
): number {
  switch (metricType) {
    case 'distance':
      if (system === 'imperial') {
        // Convert meters to miles for imperial
        return value * CONVERSION_FACTORS.METERS_TO_MILES;
      } else {
        // Convert meters to kilometers for metric
        return value / 1000;
      }
    default:
      return value;
  }
}

/**
 * Formats a metric value according to the user's measurement system preference.
 */
export function formatMetricValue(
  value: number,
  metricType: MetricType,
  system: MeasurementSystem
): FormattedMetric {
  const convertedValue = convertMetricValue(value, metricType, system);
  const unit = DISPLAY_UNITS[metricType][system];

  // Apply specific formatting rules
  let formattedValue = convertedValue;
  switch (metricType) {
    case 'distance':
      formattedValue = Number(convertedValue.toFixed(2));
      break;
    case 'calories':
    case 'basal_calories':
    case 'steps':
      formattedValue = Math.round(convertedValue);
      break;
    case 'heart_rate':
      formattedValue = Math.round(convertedValue);
      break;
    default:
      formattedValue = convertedValue;
  }

  return {
    value: formattedValue,
    unit,
  };
}

/**
 * Converts a goal value from imperial to metric for storage.
 */
export function convertGoalToMetric(
  value: number,
  metricType: MetricType,
  system: MeasurementSystem
): number {
  if (system === 'metric') return value;

  switch (metricType) {
    case 'distance':
      // Convert miles to meters for storage
      return value / CONVERSION_FACTORS.METERS_TO_MILES;
    default:
      return value;
  }
}

/**
 * Gets the default goal value for a metric type in the specified measurement system.
 */
export function getDefaultGoal(
  metricType: MetricType,
  system: MeasurementSystem
): number {
  const metricGoals: Record<MetricType, number> = {
    steps: 10000,
    distance: 5000, // 5km in meters
    calories: 500,
    heart_rate: 75,
    exercise: 30,
    basal_calories: 1800,
    flights_climbed: 10,
  };

  const value = metricGoals[metricType];
  return system === 'metric' ? value : convertMetricValue(value, metricType, system);
}
