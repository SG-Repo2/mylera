import type { Permission } from 'react-native-health-connect';

// Retry configuration for Android's slower health connect
export const RETRY_CONFIG = {
  MAX_RETRIES: 5,
  INITIAL_DELAY: 2000, // 2 seconds
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_FACTOR: 1.5,
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
  { accessType: 'read', recordType: 'ExerciseSession' },
];

// Group permissions by priority for graceful degradation
export const PERMISSION_GROUPS = {
  essential: ['Steps', 'Distance', 'ActiveCaloriesBurned'],
  important: ['HeartRate', 'BasalMetabolicRate'],
  optional: ['FloorsClimbed', 'ExerciseSession'],
};

// Helper to check if essential permissions are granted
export const hasEssentialPermissions = (grantedPermissions: string[]): boolean => {
  return PERMISSION_GROUPS.essential.every(permission => grantedPermissions.includes(permission));
};
