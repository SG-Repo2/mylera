import { MetricType } from '../types/metrics';
import { METRIC_UNITS } from '../providers/health/types/metrics';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatMetricValue, MeasurementSystem } from '../utils/unitConversion';

// Helper functions for formatting values with measurement system support
const formatters = {
  steps: (value: number, system: MeasurementSystem = 'metric') => 
    formatMetricValue(value, 'steps', system).value.toLocaleString(),
  distance: (value: number, system: MeasurementSystem = 'metric') => 
    formatMetricValue(value, 'distance', system).value.toString(),
  calories: (value: number, system: MeasurementSystem = 'metric') => 
    formatMetricValue(value, 'calories', system).value.toLocaleString(),
  heart_rate: (value: number, system: MeasurementSystem = 'metric') => 
    formatMetricValue(value, 'heart_rate', system).value.toString(),
  exercise: (value: number, system: MeasurementSystem = 'metric') => 
    formatMetricValue(value, 'exercise', system).value.toString(),
  basal_calories: (value: number, system: MeasurementSystem = 'metric') => 
    formatMetricValue(value, 'basal_calories', system).value.toLocaleString(),
  flights_climbed: (value: number, system: MeasurementSystem = 'metric') => 
    formatMetricValue(value, 'flights_climbed', system).value.toString(),
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
  formatValue: (value: any, system?: MeasurementSystem) => string;
  calculateProgress: (value: any, goal: any) => number;
  pointIncrement: {
    value: number;    // Amount of metric value per point
    maxPoints: number; // Maximum points possible
  };
}

// Helper function to calculate points based on value and increment settings
const calculatePoints = (value: number, increment: number, maxPoints: number): number => {
  const points = Math.floor(value / increment);
  return Math.min(points, maxPoints);
};

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
    pointIncrement: {
      value: 100, // 1 point per 100 steps
      maxPoints: 100
    }
  },
  distance: {
    id: 'distance',
    title: 'Distance',
    icon: 'map-marker-distance',
    defaultGoal: 4828, // 3 miles = 4828 meters
    unit: METRIC_UNITS.DISTANCE,
    color: '#AF52DE',
    formatValue: formatters.distance,
    calculateProgress: progressCalculators.distance,
    pointIncrement: {
      value: 160.934, // 1 point per 0.1 miles (in meters)
      maxPoints: 30
    }
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
    pointIncrement: {
      value: 10, // 1 point per 10 calories
      maxPoints: 50
    }
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
    pointIncrement: {
      value: 1, // Special case - points based on target zone
      maxPoints: 30
    }
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
    pointIncrement: {
      value: 1, // 1 point per minute
      maxPoints: 30
    }
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
    pointIncrement: {
      value: 20, // 1 point per 20 calories
      maxPoints: 90
    }
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
    pointIncrement: {
      value: 0.5, // 2 points per flight
      maxPoints: 20
    }
  }
};

export default healthMetrics;
