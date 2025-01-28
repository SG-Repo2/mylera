import { MetricType } from '../../../types/metrics';

// Raw metric data from health platforms
export interface RawHealthMetric {
  startDate: string;
  endDate: string;
  value: number;
  unit: string;
  sourceBundle?: string;  // For platform-specific source identification
}

export interface RawHealthData {
  steps?: RawHealthMetric[];
  distance?: RawHealthMetric[];  // Usually in meters or miles
  calories?: RawHealthMetric[];  // Active calories burned
  heart_rate?: RawHealthMetric[];  // BPM readings
  exercise?: RawHealthMetric[];    // Exercise minutes
  standing?: RawHealthMetric[];    // Standing hours
}

// Normalized metric with standardized units
export interface NormalizedMetric {
  timestamp: string;      // ISO string
  value: number;
  unit: string;          // Using string literals instead of enum
  type: MetricType;
  confidence?: number;   // Optional confidence score (0-1)
}

// Standardized units as string literals
export const METRIC_UNITS = {
  STEPS: 'count',
  DISTANCE: 'meters',
  CALORIES: 'kcal',
  HEART_RATE: 'bpm',
  EXERCISE: 'minutes',
  STANDING: 'hours'
} as const;

// Aggregated health metrics for storage/display
export interface HealthMetrics {
  id: string;
  user_id: string;
  date: string;
  steps: number | null;
  distance: number | null;      // Always in meters
  calories: number | null;      // Always in kcal
  heart_rate: number | null;    // Average BPM for the period
  daily_score: number;
  weekly_score: number | null;
  streak_days: number | null;
  last_updated: string;
  created_at: string;
  updated_at: string;
}

// Unit conversion utilities
export interface UnitConversion {
  from: string;
  to: string;
  ratio: number;
}

// Common unit conversions
export const UNIT_CONVERSIONS: Record<string, UnitConversion[]> = {
  distance: [
    { from: 'miles', to: 'meters', ratio: 1609.34 },
    { from: 'kilometers', to: 'meters', ratio: 1000 },
    { from: 'feet', to: 'meters', ratio: 0.3048 }
  ],
  calories: [
    { from: 'joules', to: 'kcal', ratio: 0.000239006 }
  ]
};