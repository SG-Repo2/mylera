import type { Permission } from 'react-native-health-connect';
import { requestPermission } from 'react-native-health-connect';
import { logger, LogCategory } from '@/src/utils/logger';
import { setPermissionVerified } from './utils';

// Retry configuration for Android's slower health connect
export const RETRY_CONFIG = {
  MAX_RETRIES: 5,
  INITIAL_DELAY: 2000, // 2 seconds
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_FACTOR: 1.5
};

// Permission request timeout
export const PERMISSION_REQUEST_TIMEOUT = 15000; // 15 seconds

export const HEALTH_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'FloorsClimbed' },
  { accessType: 'read', recordType: 'BasalMetabolicRate' },
  { accessType: 'read', recordType: 'ExerciseSession' }
];

// Group permissions by priority for graceful degradation
export const PERMISSION_GROUPS = {
  essential: ['Steps', 'Distance', 'ActiveCaloriesBurned'],
  important: ['HeartRate', 'BasalMetabolicRate'],
  optional: ['FloorsClimbed', 'ExerciseSession']
};

// Helper to check if essential permissions are granted
export const hasEssentialPermissions = (grantedPermissions: string[]): boolean => {
  return PERMISSION_GROUPS.essential.every(
    permission => grantedPermissions.includes(permission)
  );
};

/**
 * Directly verifies Health Connect permissions with the API
 * This forces a reliable permission check through the Android API
 */
export async function verifyHealthConnectPermissions(): Promise<boolean> {
  try {
    logger.info(LogCategory.Health, '[GoogleHealthProvider] Verifying Health Connect permissions directly');
    
    // Use requestPermission with showPrompt=false to check without showing UI
    const grantedPermissions = await requestPermission(HEALTH_PERMISSIONS);
    
    // Count how many permissions are granted
    const grantCount = grantedPermissions.length;
    
    // Log the granted permissions
    logger.info(
      LogCategory.Health,
      `[GoogleHealthProvider] Permission verification result: ${grantCount}/${HEALTH_PERMISSIONS.length} permissions granted`
    );
    
    // Store the verification result
    const hasMinimumPermissions = grantCount >= 3; // At least 3 permissions
    await setPermissionVerified(hasMinimumPermissions);
    
    return hasMinimumPermissions;
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[GoogleHealthProvider] Direct permission verification failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    
    // Mark permissions as not verified on error
    await setPermissionVerified(false);
    return false;
  }
}

/**
 * Request Health Connect permissions with UI prompt
 */
export async function requestHealthConnectPermissions(): Promise<string[]> {
  try {
    logger.info(LogCategory.Health, '[GoogleHealthProvider] Requesting Health Connect permissions with prompt');
    
    // Force showing the permission dialog
    const grantedPermissions = await requestPermission(HEALTH_PERMISSIONS);
    
    // Store the verification result
    const hasMinimumPermissions = grantedPermissions.length >= 3;
    await setPermissionVerified(hasMinimumPermissions);
    
    logger.info(
      LogCategory.Health,
      `[GoogleHealthProvider] Permission request result: ${grantedPermissions.length}/${HEALTH_PERMISSIONS.length} permissions granted`
    );
    
    return grantedPermissions.map(permission => permission.recordType);
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[GoogleHealthProvider] Permission request failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    
    // Mark permissions as not verified on error
    await setPermissionVerified(false);
    return [];
  }
}