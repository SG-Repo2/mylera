// src/utils/scoringUtils.ts
import { MetricType } from '../types/schemas';
import type { MetricConfig } from '../config/healthMetrics';
import { healthMetrics } from '../config/healthMetrics';

interface ScoringOptions {
  // Remove isProduction option if production behavior is always desired.
  date?: string;
}

export interface MetricScore {
  points: number;
  goalReached: boolean;
  value: number;
  goal: number;
}

export interface TotalScore {
  totalPoints: number;
  metricsCompleted: number;
  metrics: Array<{
    metric_type: MetricType;
    points: number;
    goal_reached: boolean;
    value: number;
    goal: number;
  }>;
}

/**
 * Calculate points for a single metric using production logic.
 */
export function calculateMetricPoints(
  metricType: MetricType,
  value: number,
  config: MetricConfig,
  // Remove options to always use production behavior.
): MetricScore {
  if (typeof value !== 'number' || isNaN(value)) {
    return {
      points: 0,
      goalReached: false,
      value: 0,
      goal: Number(config.defaultGoal)
    };
  }

  const goal = Number(config.defaultGoal);

  // Special handling for heart rate
  if (metricType === 'heart_rate') {
    const allowedDeviation = 15;
    const deviation = Math.abs(value - goal);
    const points = Math.round(config.pointIncrement.maxPoints * (1 - Math.min(deviation / allowedDeviation, 1)));
    return {
      points,
      goalReached: deviation <= allowedDeviation,
      value,
      goal
    };
  }

  // Production metric scoring for all other metrics
  const goalReached = value >= goal;
  // Calculate points based on percentage of goal achieved, capped at max points
  const percentageAchieved = value / goal;
  let points = Math.min(
    Math.floor(percentageAchieved * config.pointIncrement.maxPoints),
    config.pointIncrement.maxPoints
  );

  // Add bonus points for exceeding goal (max 25% bonus)
  if (goalReached) {
    const bonusPoints = Math.min(Math.floor((percentageAchieved - 1) * 25), 25);
    points += bonusPoints;
  }

  return {
    points,
    goalReached,
    value,
    goal
  };
}

/**
 * Calculate total score from multiple metrics.
 */
export function calculateTotalScore(
  metrics: Array<{ metric_type: MetricType; value: number }>
): TotalScore {
  const scoredMetrics = metrics.map(metric => {
    const config = healthMetrics[metric.metric_type];
    const score = calculateMetricPoints(metric.metric_type, metric.value, config);
    return {
      metric_type: metric.metric_type,
      points: score.points,
      goal_reached: score.goalReached,
      value: score.value,
      goal: score.goal
    };
  });

  return {
    totalPoints: scoredMetrics.reduce((sum, metric) => sum + metric.points, 0),
    metricsCompleted: scoredMetrics.filter(metric => metric.goal_reached).length,
    metrics: scoredMetrics
  };
}

/**
 * Validate metric value against constraints.
 */
export function validateMetricValue(
  metricType: MetricType,
  value: number
): boolean {
  if (typeof value !== 'number' || isNaN(value)) {
    console.log(`Invalid value type for ${metricType}: ${value}`);
    return false;
  }

  const config = healthMetrics[metricType];
  if (!config) {
    console.log(`No config found for metric type: ${metricType}`);
    return false;
  }

  // Ensure value is within reasonable bounds.
  if (value < 0) {
    console.log(`Negative value for ${metricType}: ${value}`);
    return false;
  }

  switch (metricType) {
    case 'heart_rate':
      return (value >= 0 && value <= 220);
    case 'distance':
      return value >= 0 && value <= 50000; // Max 50km (50000 meters) per day
    case 'steps':
    case 'calories':
    case 'basal_calories':
    case 'flights_climbed':
    case 'exercise':
      return value >= 0;
    default:
      const validNumber = typeof value === 'number' && !isNaN(value);
      if (!validNumber) {
        console.log(`Invalid value for ${metricType}: ${value}`);
      }
      return validNumber;
  }
}