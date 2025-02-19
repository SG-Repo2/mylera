import type { Permission } from 'react-native-health-connect';

export const PERMISSION_TYPES = {
  STEPS: 'Steps',
  DISTANCE: 'Distance',
  ACTIVE_CALORIES: 'ActiveCaloriesBurned',
  HEART_RATE: 'HeartRate',
  FLOORS: 'FloorsClimbed',
  BMR: 'BasalMetabolicRate',
  EXERCISE: 'ExerciseSession'
} as const;

export type PermissionType = typeof PERMISSION_TYPES[keyof typeof PERMISSION_TYPES];

export const PERMISSION_DESCRIPTIONS = {
  [PERMISSION_TYPES.STEPS]: 'step count tracking',
  [PERMISSION_TYPES.DISTANCE]: 'distance tracking',
  [PERMISSION_TYPES.ACTIVE_CALORIES]: 'active calories tracking',
  [PERMISSION_TYPES.HEART_RATE]: 'heart rate monitoring',
  [PERMISSION_TYPES.FLOORS]: 'floors climbed tracking',
  [PERMISSION_TYPES.BMR]: 'basal metabolic rate tracking',
  [PERMISSION_TYPES.EXERCISE]: 'exercise session tracking'
} as const;

export const ANDROID_PERMISSIONS = {
  [PERMISSION_TYPES.STEPS]: 'android.permission.health.READ_STEPS',
  [PERMISSION_TYPES.DISTANCE]: 'android.permission.health.READ_DISTANCE',
  [PERMISSION_TYPES.ACTIVE_CALORIES]: 'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  [PERMISSION_TYPES.HEART_RATE]: 'android.permission.health.READ_HEART_RATE',
  [PERMISSION_TYPES.FLOORS]: 'android.permission.health.READ_FLOORS_CLIMBED',
  [PERMISSION_TYPES.BMR]: 'android.permission.health.READ_BASAL_METABOLIC_RATE',
  [PERMISSION_TYPES.EXERCISE]: 'android.permission.health.READ_EXERCISE'
} as const;

export const HEALTH_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: PERMISSION_TYPES.STEPS },
  { accessType: 'read', recordType: PERMISSION_TYPES.DISTANCE },
  { accessType: 'read', recordType: PERMISSION_TYPES.ACTIVE_CALORIES },
  { accessType: 'read', recordType: PERMISSION_TYPES.HEART_RATE },
  { accessType: 'read', recordType: PERMISSION_TYPES.FLOORS },
  { accessType: 'read', recordType: PERMISSION_TYPES.BMR },
  { accessType: 'read', recordType: PERMISSION_TYPES.EXERCISE }
];

export function getPermissionDescription(permissionType: PermissionType): string {
  return PERMISSION_DESCRIPTIONS[permissionType] || 'health data access';
}

export function getAndroidPermission(permissionType: PermissionType): string {
  const permission = ANDROID_PERMISSIONS[permissionType];
  if (!permission) {
    console.warn(`[Permissions] No Android permission mapping found for ${permissionType}`);
    return '';
  }
  return permission;
}

export function validatePermissionType(permissionType: string): permissionType is PermissionType {
  const isValid = Object.values(PERMISSION_TYPES).includes(permissionType as PermissionType);
  if (!isValid) {
    console.warn(`[Permissions] Invalid permission type: ${permissionType}`);
  }
  return isValid;
}

export function getAllRequiredPermissions(): PermissionType[] {
  return Object.values(PERMISSION_TYPES);
}

export function getMissingPermissions(grantedPermissions: PermissionType[]): PermissionType[] {
  const requiredPermissions = getAllRequiredPermissions();
  const missing = requiredPermissions.filter(permission => !grantedPermissions.includes(permission));
  
  if (missing.length > 0) {
    console.warn('[Permissions] Missing required permissions:', missing);
  }
  
  return missing;
}

export function formatPermissionError(permissionType: PermissionType, error: Error): string {
  const description = getPermissionDescription(permissionType);
  const androidPermission = getAndroidPermission(permissionType);
  
  return `Failed to access ${description}. Android permission required: ${androidPermission}. Error: ${error.message}`;
}
