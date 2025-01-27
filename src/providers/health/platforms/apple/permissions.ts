import { HealthKitPermissions, HealthPermission } from 'react-native-health';

// Define permission strings directly to avoid initialization timing issues
export const HEALTH_PERMISSIONS: Record<string, HealthPermission> = {
  StepCount: 'StepCount' as HealthPermission,
  DistanceWalkingRunning: 'DistanceWalkingRunning' as HealthPermission,
  ActiveEnergyBurned: 'ActiveEnergyBurned' as HealthPermission,
  HeartRate: 'HeartRate' as HealthPermission,
};

export const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      HEALTH_PERMISSIONS.StepCount,
      HEALTH_PERMISSIONS.DistanceWalkingRunning,
      HEALTH_PERMISSIONS.ActiveEnergyBurned,
      HEALTH_PERMISSIONS.HeartRate,
    ],
    write: [],
  },
};