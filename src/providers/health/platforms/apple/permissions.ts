import { HealthKitPermissions, HealthPermission } from 'react-native-health';

// Define permission strings directly to avoid initialization timing issues
export const HEALTH_PERMISSIONS: Record<string, HealthPermission> = {
  StepCount: 'StepCount' as HealthPermission,
  DistanceWalkingRunning: 'DistanceWalkingRunning' as HealthPermission,
  ActiveEnergyBurned: 'ActiveEnergyBurned' as HealthPermission,
  HeartRate: 'HeartRate' as HealthPermission,
  FlightsClimbed: 'FlightsClimbed' as HealthPermission,
  BasalEnergyBurned: 'BasalEnergyBurned' as HealthPermission,
  AppleExerciseTime: 'AppleExerciseTime' as HealthPermission,
};

// Group permissions by category for optimized batching
export const PERMISSION_GROUPS = {
  activity: [
    HEALTH_PERMISSIONS.StepCount,
    HEALTH_PERMISSIONS.DistanceWalkingRunning,
    HEALTH_PERMISSIONS.FlightsClimbed,
    HEALTH_PERMISSIONS.AppleExerciseTime,
  ],
  energy: [
    HEALTH_PERMISSIONS.ActiveEnergyBurned,
    HEALTH_PERMISSIONS.BasalEnergyBurned,
  ],
  vitals: [
    HEALTH_PERMISSIONS.HeartRate,
  ],
};

// Create optimized permission batches
export const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      // Request all permissions in a single batch
      ...PERMISSION_GROUPS.activity,
      ...PERMISSION_GROUPS.energy,
      ...PERMISSION_GROUPS.vitals,
    ],
    write: [], // We only need read permissions
  },
};

// Helper function to check if specific permission group is granted
export const isPermissionGroupGranted = (
  permissionResponses: Record<string, boolean>,
  group: keyof typeof PERMISSION_GROUPS
): boolean => {
  return PERMISSION_GROUPS[group].every(
    permission => permissionResponses[permission]
  );
};