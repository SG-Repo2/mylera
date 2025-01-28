import { MetricType } from '../../types/metrics';
import { HealthMetrics } from '../../providers/health/types/metrics';
import { MetricConfig } from '../../config/healthMetrics';

export const getMetricValue = (metrics: HealthMetrics, type: MetricType): number => {
  return metrics?.[type] || 0;
};

export const calculateProgress = (value: number, config: MetricConfig): number => {
  return config.calculateProgress(value, config.defaultGoal);
};

export const shouldShowAlert = (type: MetricType, value: number, config: MetricConfig): boolean => {
  if (type === 'heart_rate') {
    const [min, max] = config.defaultGoal.toString().split('-').map(Number);
    return value < min || value > max;
  }
  return false;
};