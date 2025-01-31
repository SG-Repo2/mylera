import { MetricType } from '../types/metrics';
import { METRIC_UNITS } from '../providers/health/types/metrics';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

// Helper functions for formatting values
const formatters = {
  steps: (value: number) => Math.round(value).toLocaleString(),
  distance: (value: number) => {
    const km = value / 1000;
    return `${km.toFixed(2)}`;
  },
  calories: (value: number) => Math.round(value).toLocaleString(),
  heart_rate: (value: number) => Math.round(value).toString(),
  exercise: (value: number) => Math.round(value).toString(),
  basal_calories: (value: number) => Math.round(value).toLocaleString(),
  flights_climbed: (value: number) => Math.round(value).toString(),
};

// Helper functions for calculating progress (0-1)
const progressCalculators = {
  steps: (value: number, goal: number) => Math.min(value / goal, 1),
  distance: (value: number, goal: number) => Math.min(value / goal, 1),
  calories: (value: number, goal: number) => Math.min(value / goal, 1),
  heart_rate: (value: number, goal: number) => {
    // For heart rate, allow within 15 BPM above or below goal
    const targetValue = Number(goal);
    const minAcceptable = targetValue - 15;
    const maxAcceptable = targetValue + 15;
    if (value < minAcceptable || value > maxAcceptable) return 0;
    // Calculate progress based on how close to target
    const deviation = Math.abs(value - targetValue);
    return Math.max(0, 1 - deviation / 15);
  },
  exercise: (value: number, goal: number) => Math.min(value / goal, 1),
  basal_calories: (value: number, goal: number) => Math.min(value / goal, 1),
  flights_climbed: (value: number, goal: number) => Math.min(value / goal, 1),
};

export interface MetricConfig {
  id: MetricType;
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  defaultGoal: number;
  unit: string;
  color: string;
  formatValue: (value: any) => string;
  calculateProgress: (value: any, goal: any) => number;
  displayUnit: string; // Human readable unit
}

export const healthMetrics: Record<MetricType, MetricConfig> = {
  steps: {
    id: 'steps',
    title: 'Steps',
    icon: 'shoe-print',
    defaultGoal: 10000,
    unit: METRIC_UNITS.STEPS,
    color: '#FF9500',
    formatValue: formatters.steps,
    calculateProgress: progressCalculators.steps,
    displayUnit: 'steps'
  },
  distance: {
    id: 'distance',
    title: 'Distance',
    icon: 'map-marker-distance',
    defaultGoal: 5000, // 5km in meters
    unit: METRIC_UNITS.DISTANCE,
    color: '#AF52DE',
    formatValue: formatters.distance,
    calculateProgress: progressCalculators.distance,
    displayUnit: 'km'
  },
  calories: {
    id: 'calories',
    title: 'Active Calories',
    icon: 'fire',
    defaultGoal: 500,
    unit: METRIC_UNITS.CALORIES,
    color: '#FF2D55',
    formatValue: formatters.calories,
    calculateProgress: progressCalculators.calories,
    displayUnit: 'kcal'
  },
  heart_rate: {
    id: 'heart_rate',
    title: 'Heart Rate',
    icon: 'heart-pulse',
    defaultGoal: 75, // Range
    unit: METRIC_UNITS.HEART_RATE,
    color: '#FC3D39',
    formatValue: formatters.heart_rate,
    calculateProgress: progressCalculators.heart_rate,
    displayUnit: 'BPM'
  },
  exercise: {
    id: 'exercise',
    title: 'Exercise',
    icon: 'run',
    defaultGoal: 30,
    unit: METRIC_UNITS.EXERCISE,
    color: '#30D158',
    formatValue: formatters.exercise,
    calculateProgress: progressCalculators.exercise,
    displayUnit: 'min'
  },
  basal_calories: {
    id: 'basal_calories',
    title: 'Basal Calories',
    icon: 'fire-circle',
    defaultGoal: 1800,
    unit: METRIC_UNITS.CALORIES,
    color: '#FF9500',
    formatValue: formatters.basal_calories,
    calculateProgress: progressCalculators.basal_calories,
    displayUnit: 'kcal'
  },
  flights_climbed: {
    id: 'flights_climbed',
    title: 'Flights Climbed',
    icon: 'stairs',
    defaultGoal: 10,
    unit: METRIC_UNITS.COUNT,
    color: '#5856D6',
    formatValue: formatters.flights_climbed,
    calculateProgress: progressCalculators.flights_climbed,
    displayUnit: 'flights'
  }
};

export default healthMetrics;