import AppleHealthKit from 'react-native-health';
import { promisify } from '../../../../utils/promiseWrapper';
import { logger, LogCategory } from '@/src/utils/logger';

/**
 * HealthKit permission configuration
 */
export const HEALTH_PERMISSIONS = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.BasalEnergyBurned,
      AppleHealthKit.Constants.Permissions.FlightsClimbed,
      AppleHealthKit.Constants.Permissions.AppleExerciseTime
    ],
    write: []
  }
};

/**
 * Complete permissions configuration for HealthKit initialization
 */
export const permissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.BasalEnergyBurned,
      AppleHealthKit.Constants.Permissions.FlightsClimbed,
      AppleHealthKit.Constants.Permissions.AppleExerciseTime
    ],
    write: []
  }
};

/**
 * Check if HealthKit is available on this device
 * @returns Promise resolving to availability status
 */
export async function checkHealthKitAvailability(): Promise<boolean> {
  try {
    const available = await promisify<boolean>(AppleHealthKit.isAvailable);
    return available;
  } catch (error) {
    logger.error(LogCategory.Health, '[AppleHealthProvider] Error checking availability:', 
      error instanceof Error ? error.message : String(error));
    return false;
  }
}