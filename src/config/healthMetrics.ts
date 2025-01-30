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
  standing: (value: number) => Math.round(value).toString(),
  sleep: (value: number) => {
    const hours = Math.floor(value / 60);
    const minutes = Math.round(value % 60);
    return `${hours}h ${minutes}m`;
  }
};

// Helper functions for calculating progress (0-1)
const progressCalculators = {
  steps: (value: number, goal: number) => Math.min(value / goal, 1),
  distance: (value: number, goal: number) => Math.min(value / goal, 1),
  calories: (value: number, goal: number) => Math.min(value / goal, 1),
  heart_rate: (value: number, goal: number) => {
    // For heart rate, assume goal is the target range (e.g., 60-100 BPM)
    const [min, max] = goal.toString().split('-').map(Number);
    if (value < min) return 0;
    if (value > max) return 0;
    return 1;
  },
  exercise: (value: number, goal: number) => Math.min(value / goal, 1),
  standing: (value: number, goal: number) => Math.min(value / goal, 1),
  sleep: (value: number, goal: number) => Math.min(value / goal, 1)
};

export interface MetricConfig {
  id: MetricType;
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  defaultGoal: number;
  unit: string;
  color: string;
  formatValue: (value: number) => string;
  calculateProgress: (value: number, goal: number) => number;
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
    defaultGoal: 60-100, // Range
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
  standing: {
    id: 'standing',
    title: 'Standing',
    icon: 'human-handsup',
    defaultGoal: 12,
    unit: METRIC_UNITS.STANDING,
    color: '#5856D6',
    formatValue: formatters.standing,
    calculateProgress: progressCalculators.standing,
    displayUnit: 'hrs'
  },
  sleep: {
    id: 'sleep',
    title: 'Sleep',
    icon: 'sleep',
    defaultGoal: 8 * 60, // 8 hours in minutes
    unit: METRIC_UNITS.SLEEP,
    color: '#8E44AD', // Purple shade as specified in ADR
    formatValue: formatters.sleep,
    calculateProgress: progressCalculators.sleep,
    displayUnit: 'hrs'
  }
};

export default healthMetrics;