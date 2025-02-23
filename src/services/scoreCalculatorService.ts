import { healthMetrics } from '../config/healthMetrics';
import type { MetricType } from '../types/metrics';
import type { HealthMetrics } from '../providers/health/types/metrics';
import type { DailyMetricScore } from '../types/schemas';

export interface ScoreResult {
  points: number;
  goalReached: boolean;
  validationErrors?: string[];
}

export interface MetricValidationResult {
  isValid: boolean;
  errors: string[];
}

class ScoreCalculatorService {
  // Validate metric value based on type-specific rules
  private validateMetricValue(type: MetricType, value: number): MetricValidationResult {
    const config = healthMetrics[type];
    const result: MetricValidationResult = { isValid: true, errors: [] };

    // Basic validation
    if (value === null || value === undefined || isNaN(value)) {
      result.errors.push(`Invalid ${type} value: ${value}`);
      result.isValid = false;
      return result;
    }

    // Type-specific validation
    switch (type) {
      case 'steps':
      case 'calories':
      case 'basal_calories':
      case 'flights_climbed':
        if (value < 0) {
          result.errors.push(`${type} cannot be negative`);
          result.isValid = false;
        }
        if (value > 100000) { // Reasonable upper limit
          result.errors.push(`${type} value too high: ${value}`);
          result.isValid = false;
        }
        break;

      case 'heart_rate':
        if (value < 30 || value > 220) {
          result.errors.push(`Heart rate outside reasonable range: ${value}`);
          result.isValid = false;
        }
        break;

      case 'distance':
        if (value < 0) {
          result.errors.push('Distance cannot be negative');
          result.isValid = false;
        }
        if (value > 100000) { // 100km in meters
          result.errors.push(`Distance value too high: ${value}`);
          result.isValid = false;
        }
        break;

      case 'exercise':
        if (value < 0) {
          result.errors.push('Exercise minutes cannot be negative');
          result.isValid = false;
        }
        if (value > 1440) { // 24 hours in minutes
          result.errors.push(`Exercise minutes too high: ${value}`);
          result.isValid = false;
        }
        break;
    }

    return result;
  }

  // Calculate points for a single metric
  calculateMetricScore(type: MetricType, value: number): ScoreResult {
    const validation = this.validateMetricValue(type, value);
    if (!validation.isValid) {
      return {
        points: 0,
        goalReached: false,
        validationErrors: validation.errors
      };
    }

    const config = healthMetrics[type];
    let points = 0;
    let goalReached = false;

    // Special calculation for heart rate
    if (type === 'heart_rate') {
      const targetValue = config.defaultGoal;
      const deviation = Math.abs(value - targetValue);
      points = Math.max(0, config.pointIncrement.maxPoints * (1 - deviation / 15));
      goalReached = deviation <= 15;
    } else {
      // Standard calculation for other metrics
      points = Math.floor(value / config.pointIncrement.value);
      points = Math.min(points, config.pointIncrement.maxPoints);
      goalReached = value >= config.defaultGoal;
    }

    return {
      points: Math.round(points), // Ensure whole numbers
      goalReached,
      validationErrors: []
    };
  }

  // Calculate total score from all metrics
  calculateTotalScore(metrics: HealthMetrics): number {
    let totalPoints = 0;

    Object.entries(healthMetrics).forEach(([type, config]) => {
      const metricType = type as MetricType;
      const value = metrics[metricType];

      if (value !== null && value !== undefined && !isNaN(value)) {
        const { points } = this.calculateMetricScore(metricType, value);
        totalPoints += points;
      }
    });

    return totalPoints;
  }

  // Verify total score matches sum of individual metrics
  verifyTotalScore(metrics: DailyMetricScore[], totalScore: number): boolean {
    const calculatedTotal = metrics.reduce((sum, metric) => {
      const { points } = this.calculateMetricScore(metric.metric_type, metric.value);
      return sum + points;
    }, 0);

    return calculatedTotal === totalScore;
  }

  // Get completed metrics count
  getCompletedMetricsCount(metrics: HealthMetrics): number {
    return Object.entries(healthMetrics)
      .filter(([type]) => {
        const metricType = type as MetricType;
        const value = metrics[metricType];
        return value !== null && value !== undefined && !isNaN(value);
      })
      .length;
  }
}

export const scoreCalculatorService = new ScoreCalculatorService();
