/**
 * Standardized health data normalization utilities
 *
 * This module provides common data processing functions to ensure consistent
 * calculation of health metrics across different platform providers.
 */

import { logger, LogCategory } from '../logger';

/**
 * Standardized heart rate calculation from an array of readings
 *
 * Logic:
 * 1. Filter out invalid readings (below 30 or above 220 bpm)
 * 2. If 3 or fewer readings, return simple average
 * 3. If more readings, apply weighted average: 60% recent (newest 3) + 40% older readings
 *
 * @param heartRates Array of heart rate readings
 * @returns Standardized heart rate value
 */
export function standardizeHeartRateCalculation(heartRates: number[]): number {
  if (!heartRates || !heartRates.length) return 0;

  // Filter for physiologically valid heart rates (30-220 BPM)
  const validRates = heartRates.filter(hr => hr >= 30 && hr <= 220);

  if (!validRates.length) {
    logger.warn(LogCategory.Health, `No valid heart rates found in readings: ${heartRates}`);
    return 0;
  }

  // For few readings, use simple average
  if (validRates.length <= 3) {
    return Math.round(validRates.reduce((sum, val) => sum + val, 0) / validRates.length);
  }

  // For more readings, split between recent and older
  // Apply weighted average with higher weight to recent readings
  const recent = validRates.slice(0, 3);
  const older = validRates.slice(3);
  const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
  const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;

  // Weight: 60% recent + 40% older
  return Math.round(recentAvg * 0.6 + olderAvg * 0.4);
}

/**
 * Standardize steps calculation from raw readings
 *
 * @param steps Array of step counts
 * @returns Standardized step count
 */
export function standardizeStepsCalculation(steps: number[]): number {
  if (!steps || !steps.length) return 0;

  // Filter out negative values
  const validSteps = steps.filter(s => s >= 0);

  if (!validSteps.length) {
    logger.warn(LogCategory.Health, `No valid step counts found in readings: ${steps}`);
    return 0;
  }

  // For steps, we typically want the sum, not the average
  // However, some providers might double-count steps, so we take the max value
  // assuming it's a cumulative count for the day
  return Math.max(...validSteps);
}

/**
 * Standardize calories calculation from raw readings
 *
 * @param calories Array of calorie counts
 * @returns Standardized calorie count
 */
export function standardizeCaloriesCalculation(calories: number[]): number {
  if (!calories || !calories.length) return 0;

  // Filter out negative or unreasonably high values (> 10,000 calories)
  const validCalories = calories.filter(c => c >= 0 && c <= 10000);

  if (!validCalories.length) {
    logger.warn(LogCategory.Health, `No valid calorie counts found in readings: ${calories}`);
    return 0;
  }

  // Similar to steps, we take the max value assuming it's a cumulative count
  return Math.round(Math.max(...validCalories));
}

/**
 * Standardize distance calculation from raw readings
 *
 * @param distances Array of distance values in meters
 * @returns Standardized distance in meters
 */
export function standardizeDistanceCalculation(distances: number[]): number {
  if (!distances || !distances.length) return 0;

  // Filter out negative or unreasonably high values (> 100 km)
  const validDistances = distances.filter(d => d >= 0 && d <= 100000);

  if (!validDistances.length) {
    logger.warn(LogCategory.Health, `No valid distance values found in readings: ${distances}`);
    return 0;
  }

  // Similar to steps, we take the max value assuming it's a cumulative distance
  return Math.round(Math.max(...validDistances));
}

/**
 * Utility function to filter outliers from a dataset
 *
 * @param values Array of numeric values
 * @returns Array with outliers removed
 */
export function removeOutliers(values: number[]): number[] {
  if (!values || values.length <= 2) return values;

  // Sort values
  const sorted = [...values].sort((a, b) => a - b);

  // Calculate Q1 and Q3
  const q1Index = Math.floor(sorted.length / 4);
  const q3Index = Math.floor((sorted.length * 3) / 4);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];

  // Calculate IQR and bounds
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Filter out outliers
  return values.filter(val => val >= lowerBound && val <= upperBound);
}
