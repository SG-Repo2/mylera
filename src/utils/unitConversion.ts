import { MetricType } from '../types/schemas';

export type MeasurementSystem = 'metric' | 'imperial';

export const DISPLAY_UNITS: Record<MetricType, Record<MeasurementSystem, string>> = {
  steps: { metric: '', imperial: '' },
  distance: { metric: 'km', imperial: 'mi' },
  calories: { metric: 'kcal', imperial: 'kcal' },
  heart_rate: { metric: 'bpm', imperial: 'bpm' },
  exercise: { metric: 'min', imperial: 'min' },
  basal_calories: { metric: 'kcal', imperial: 'kcal' },
  flights_climbed: { metric: '', imperial: '' },
};

export interface FormattedMetricValue {
  value: number;
  unit: string;
  rawValue?: number;
}

/**
 * Formats a metric value according to the user's preferred measurement system
 * @param value The raw metric value
 * @param metricType The type of metric being formatted
 * @param system The user's preferred measurement system
 * @returns Formatted value and unit
 */
export const formatMetricValue = (
  value: number,
  metricType: MetricType,
  system: MeasurementSystem = 'metric'
): FormattedMetricValue => {
  if (value === null || value === undefined || isNaN(value)) {
    return { value: 0, unit: DISPLAY_UNITS[metricType][system] };
  }

  switch (metricType) {
    case 'distance':
      if (system === 'imperial') {
        return {
          value: parseFloat((value / 1609.34).toFixed(2)),
          unit: 'mi',
        };
      }
      return {
        value: parseFloat((value / 1000).toFixed(2)),
        unit: 'km',
      };

    case 'steps':
      // For steps, we want to keep the raw value but indicate if it should be displayed in K format
      const shouldUseKFormat = value >= 10000;
      return {
        value: shouldUseKFormat ? parseFloat((value / 1000).toFixed(1)) : value,
        unit: shouldUseKFormat ? 'K' : '',
        rawValue: value, // Keep the raw value for calculations
      };

    case 'calories':
    case 'basal_calories':
      return {
        value: Math.round(value),
        unit: 'kcal',
      };

    case 'heart_rate':
      return {
        value: Math.round(value),
        unit: 'bpm',
      };

    case 'exercise':
      return {
        value: Math.round(value),
        unit: 'min',
      };

    case 'flights_climbed':
      return {
        value: Math.round(value),
        unit: '',
      };

    default:
      return {
        value,
        unit: DISPLAY_UNITS[metricType][system] || '',
      };
  }
};

// Add conversion utilities for raw values
export const convertToImperial = (value: number, metricType: MetricType): number => {
  switch (metricType) {
    case 'distance':
      return value / 1609.34; // meters to miles
    default:
      return value;
  }
};

export const convertToMetric = (value: number, metricType: MetricType): number => {
  switch (metricType) {
    case 'distance':
      return value * 1609.34; // miles to meters
    default:
      return value;
  }
};
