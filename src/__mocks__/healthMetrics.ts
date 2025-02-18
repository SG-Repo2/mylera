import { MetricType } from '@/src/types/metrics';
import { METRIC_UNITS } from '@/src/providers/health/types/metrics';
import type { MeasurementSystem } from '@/src/utils/unitConversion';
import type { TestHealthData } from '@/src/__tests__/types/test.types';

// Validation rules for health metrics
const validationRules = {
  steps: { min: 0, max: 100000 },
  distance: { min: 0, max: 50000 },
  calories: { min: 0, max: 10000 },
  heart_rate: { min: 30, max: 220 },
  exercise: { min: 0, max: 1440 },
  basal_calories: { min: 500, max: 5000 },
  flights_climbed: { min: 0, max: 500 }
};

// Validation function for health metrics
const validateMetricValue = (metricType: MetricType, value: number): boolean => {
  const rules = validationRules[metricType];
  if (!rules) return true;
  return value >= rules.min && value <= rules.max;
};

// Enhanced formatters with validation
const formatters = {
  steps: jest.fn((value: number) => value.toLocaleString()),
  distance: jest.fn((value: number) => value.toString()),
  calories: jest.fn((value: number) => value.toLocaleString()),
  heart_rate: jest.fn((value: number) => value.toString()),
  exercise: jest.fn((value: number) => value.toString()),
  basal_calories: jest.fn((value: number) => value.toLocaleString()),
  flights_climbed: jest.fn((value: number) => value.toString())
};

// Enhanced progress calculators with validation
const progressCalculators = {
  steps: jest.fn((value: number, goal: number) => Math.min(value / goal, 1)),
  distance: jest.fn((value: number, goal: number) => Math.min(value / goal, 1)),
  calories: jest.fn((value: number, goal: number) => Math.min(value / goal, 1)),
  heart_rate: jest.fn((value: number, goal: number) => {
    const targetValue = Number(goal);
    const minAcceptable = targetValue - 15;
    const maxAcceptable = targetValue + 15;
    if (value < minAcceptable || value > maxAcceptable) return 0;
    const deviation = Math.abs(value - targetValue);
    return Math.max(0, 1 - deviation / 15);
  }),
  exercise: jest.fn((value: number, goal: number) => Math.min(value / goal, 1)),
  basal_calories: jest.fn((value: number, goal: number) => Math.min(value / goal, 1)),
  flights_climbed: jest.fn((value: number, goal: number) => Math.min(value / goal, 1))
};

// Enhanced goal adjustment calculators with validation and error simulation
const goalAdjustmentCalculators = {
  steps: jest.fn((history: TestHealthData[]) => {
    const avgSteps = history.reduce((sum, day) => sum + (day.steps || 0), 0) / history.length;
    return Math.round(avgSteps * 1.1); // Suggest 10% increase from average
  }),
  distance: jest.fn((history: TestHealthData[]) => {
    const avgDistance = history.reduce((sum, day) => sum + (day.distance || 0), 0) / history.length;
    return Math.round(avgDistance * 1.1);
  }),
  calories: jest.fn((history: TestHealthData[]) => {
    const avgCalories = history.reduce((sum, day) => sum + (day.calories || 0), 0) / history.length;
    return Math.round(avgCalories * 1.1);
  }),
  heart_rate: jest.fn((history: TestHealthData[]) => {
    const avgHeartRate = history.reduce((sum, day) => sum + (day.heart_rate || 0), 0) / history.length;
    return Math.round(avgHeartRate);
  }),
  exercise: jest.fn((history: TestHealthData[]) => {
    const avgExercise = history.reduce((sum, day) => sum + (day.exercise || 0), 0) / history.length;
    return Math.round(avgExercise * 1.15); // Suggest 15% increase for exercise
  }),
  basal_calories: jest.fn((history: TestHealthData[]) => {
    const avgBasalCalories = history.reduce((sum, day) => sum + (day.basal_calories || 0), 0) / history.length;
    return Math.round(avgBasalCalories);
  }),
  flights_climbed: jest.fn((history: TestHealthData[]) => {
    const avgFlights = history.reduce((sum, day) => sum + (day.flights_climbed || 0), 0) / history.length;
    return Math.round(avgFlights * 1.1);
  })
};

// Trend analysis functions
const trendAnalyzers = {
  calculateTrend: jest.fn((history: TestHealthData[], metricType: MetricType): 'increasing' | 'decreasing' | 'stable' => {
    if (history.length < 2) return 'stable';
    const values = history.map(day => day[metricType] || 0);
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    const difference = secondAvg - firstAvg;
    if (difference > firstAvg * 0.05) return 'increasing';
    if (difference < -firstAvg * 0.05) return 'decreasing';
    return 'stable';
  }),
  analyzeConsistency: jest.fn((history: TestHealthData[], metricType: MetricType): number => {
    if (history.length < 2) return 1;
    const values = history.map(day => day[metricType] || 0);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, 1 - (stdDev / avg));
  })
};

// Mock metric configurations
export const healthMetrics: Record<MetricType, any> = {
  steps: {
    id: 'steps',
    title: 'Steps',
    icon: 'shoe-print',
    defaultGoal: 10000,
    unit: METRIC_UNITS.STEPS,
    color: '#FF9500',
    formatValue: formatters.steps,
    calculateProgress: progressCalculators.steps,
    suggestGoalAdjustment: goalAdjustmentCalculators.steps,
    pointIncrement: {
      value: 100,
      maxPoints: 100
    }
  },
  distance: {
    id: 'distance',
    title: 'Distance',
    icon: 'map-marker-distance',
    defaultGoal: 4828,
    unit: METRIC_UNITS.DISTANCE,
    color: '#AF52DE',
    formatValue: formatters.distance,
    calculateProgress: progressCalculators.distance,
    suggestGoalAdjustment: goalAdjustmentCalculators.distance,
    pointIncrement: {
      value: 160.934,
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
    suggestGoalAdjustment: goalAdjustmentCalculators.calories,
    pointIncrement: {
      value: 10,
      maxPoints: 50
    }
  },
  heart_rate: {
    id: 'heart_rate',
    title: 'Heart Rate',
    icon: 'heart-pulse',
    defaultGoal: 75,
    unit: METRIC_UNITS.HEART_RATE,
    color: '#FC3D39',
    formatValue: formatters.heart_rate,
    calculateProgress: progressCalculators.heart_rate,
    suggestGoalAdjustment: goalAdjustmentCalculators.heart_rate,
    pointIncrement: {
      value: 1,
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
    suggestGoalAdjustment: goalAdjustmentCalculators.exercise,
    pointIncrement: {
      value: 1,
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
    suggestGoalAdjustment: goalAdjustmentCalculators.basal_calories,
    pointIncrement: {
      value: 20,
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
    suggestGoalAdjustment: goalAdjustmentCalculators.flights_climbed,
    pointIncrement: {
      value: 0.5,
      maxPoints: 20
    }
  }
};

// Helper to reset all mock functions
export const resetHealthMetricsMocks = () => {
  Object.values(formatters).forEach(mock => mock.mockClear());
  Object.values(progressCalculators).forEach(mock => mock.mockClear());
  Object.values(goalAdjustmentCalculators).forEach(mock => mock.mockClear());
  Object.values(trendAnalyzers).forEach(mock => mock.mockClear());
};

// Enhanced simulation helpers with validation
export const simulateFormatting = (metricType: MetricType, value: number, formattedValue: string) => {
  if (!validateMetricValue(metricType, value)) {
    throw new Error(`Invalid ${metricType} value: ${value}. Must be between ${validationRules[metricType].min} and ${validationRules[metricType].max}`);
  }
  formatters[metricType].mockReturnValueOnce(formattedValue);
};

export const simulateProgress = (metricType: MetricType, progress: number) => {
  if (progress < 0 || progress > 1) {
    throw new Error(`Invalid progress value: ${progress}. Must be between 0 and 1`);
  }
  progressCalculators[metricType].mockReturnValueOnce(progress);
};

export const simulateGoalAdjustment = (metricType: MetricType, suggestedGoal: number) => {
  if (!validateMetricValue(metricType, suggestedGoal)) {
    throw new Error(`Invalid ${metricType} goal: ${suggestedGoal}. Must be between ${validationRules[metricType].min} and ${validationRules[metricType].max}`);
  }
  goalAdjustmentCalculators[metricType].mockReturnValueOnce(suggestedGoal);
};

export const simulateTrendAnalysis = (
  metricType: MetricType,
  trend: 'increasing' | 'decreasing' | 'stable',
  consistency: number
) => {
  if (!['increasing', 'decreasing', 'stable'].includes(trend)) {
    throw new Error(`Invalid trend value: ${trend}. Must be 'increasing', 'decreasing', or 'stable'`);
  }
  if (consistency < 0 || consistency > 1) {
    throw new Error(`Invalid consistency value: ${consistency}. Must be between 0 and 1`);
  }
  trendAnalyzers.calculateTrend.mockReturnValueOnce(trend);
  trendAnalyzers.analyzeConsistency.mockReturnValueOnce(consistency);
};

// Error simulation helpers
export const simulateMetricError = (metricType: MetricType, error: Error) => {
  formatters[metricType].mockImplementationOnce(() => { throw error; });
  progressCalculators[metricType].mockImplementationOnce(() => { throw error; });
  goalAdjustmentCalculators[metricType].mockImplementationOnce(() => { throw error; });
};

export const simulateCalculationError = (metricType: MetricType, error: Error) => {
  progressCalculators[metricType].mockImplementationOnce(() => { throw error; });
};

export const simulateTrendAnalysisError = (error: Error) => {
  trendAnalyzers.calculateTrend.mockImplementationOnce(() => { throw error; });
  trendAnalyzers.analyzeConsistency.mockImplementationOnce(() => { throw error; });
};

export { trendAnalyzers };
export default healthMetrics;
