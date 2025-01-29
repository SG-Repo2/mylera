import { useMemo } from 'react';
import { HealthMetrics } from '../providers/health/types/metrics';
import { METRICS_CONFIG, calculateMetricPoints, isTrackedMetric } from '../config/metricsConfig';

interface MetricsCalculation {
  totalPoints: number;
  progressPercentage: number;
  metricPoints: {
    steps: number;
    heart_rate: number;
    calories: number;
    distance: number;
  };
}

export function useMetricsCalculation(metrics: HealthMetrics | null): MetricsCalculation {
  return useMemo(() => {
    if (!metrics) {
      return {
        totalPoints: 0,
        progressPercentage: 0,
        metricPoints: {
          steps: 0,
          heart_rate: 0,
          calories: 0,
          distance: 0
        }
      };
    }

    const metricPoints = {
      steps: calculateMetricPoints('steps', metrics.steps || 0),
      heart_rate: calculateMetricPoints('heart_rate', metrics.heart_rate || 0),
      calories: calculateMetricPoints('calories', metrics.calories || 0),
      distance: calculateMetricPoints('distance', metrics.distance || 0)
    };

    const totalPoints = Object.entries(metricPoints)
      .reduce((sum, [type, points]) => {
        if (isTrackedMetric(type)) {
          return sum + points;
        }
        return sum;
      }, 0);

    return {
      totalPoints,
      progressPercentage: Math.min((totalPoints / METRICS_CONFIG.MAX_POINTS) * 100, 100),
      metricPoints
    };
  }, [metrics]);
}