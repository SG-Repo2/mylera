import { memoize } from 'lodash';
import { MetricType } from '@/src/types/schemas';

const formatNumber = (value: number, decimals: number = 0): string => {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const formatMetricValue = memoize((value: number, type: MetricType): string => {
  switch (type) {
    case 'steps':
      return formatNumber(value);
    case 'distance':
      return `${formatNumber(value / 1000, 2)} km`;
    case 'calories':
    case 'basal_calories':
      return `${formatNumber(value)} kcal`;
    case 'heart_rate':
      return `${formatNumber(value)} bpm`;
    case 'flights_climbed':
      return formatNumber(value);
    case 'exercise':
      return `${formatNumber(value)} min`;
    default:
      return formatNumber(value);
  }
});

const formatMetricLabel = memoize((type: MetricType): string => {
  switch (type) {
    case 'steps':
      return 'Steps';
    case 'distance':
      return 'Distance';
    case 'calories':
      return 'Active Calories';
    case 'basal_calories':
      return 'Basal Calories';
    case 'heart_rate':
      return 'Heart Rate';
    case 'flights_climbed':
      return 'Flights Climbed';
    case 'exercise':
      return 'Exercise Minutes';
    default:
      return type;
  }
});

const formatMetricProgress = memoize((value: number, goal: number): string => {
  const percentage = Math.min((value / goal) * 100, 100);
  return `${formatNumber(percentage, 1)}%`;
});

export {
  formatMetricValue,
  formatMetricLabel,
  formatMetricProgress,
}; 