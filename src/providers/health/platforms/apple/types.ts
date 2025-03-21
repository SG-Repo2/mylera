/**
 * Type definitions for Apple HealthKit data
 */

import { HealthInputOptions } from 'react-native-health';
import { RawHealthMetric } from '../../types/metrics';

/**
 * Interface for raw step count data from HealthKit
 */
export interface StepCountResult {
  value: number; 
  startDate: string; 
  endDate: string; 
  day?: string; // Some implementations include a day field
}

/**
 * Interface for daily sample data with consistent structure
 */
export interface DailySampleResult {
  value: number;
  startDate: string;
  endDate: string;
}

/**
 * Interface for heart rate sample data
 */
export interface HeartRateSample {
  value: number;
  startDate: string;
  endDate: string;
}

/**
 * Interface for simple value result from HealthKit
 */
export interface SimpleValueResult {
  value: number;
}

/**
 * Type for day aggregation function
 */
export type AggregatorFunction = (values: number[]) => number;

/**
 * Type for record with timestamp and value for grouping by day
 */
export interface TimestampedValue {
  startDate: string;
  value: number;
}
