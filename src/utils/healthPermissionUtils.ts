import { HealthProviderPermissionError } from '../providers/health/types/errors';

interface PermissionState {
  status: string;
  deniedPermissions?: string[];
}

export async function verifyHealthPermission(
  provider: { checkPermissionsStatus: () => Promise<PermissionState> },
  permissionType: string
): Promise<boolean> {
  console.log(`[HealthPermissionUtils] Verifying permission for ${permissionType}`);
  
  try {
    const permissionState = await provider.checkPermissionsStatus();
    console.log(`[HealthPermissionUtils] Permission state for ${permissionType}:`, permissionState);
    
    if (permissionState.status !== 'granted') {
      const deniedPermissions = permissionState.deniedPermissions || [];
      const isDenied = deniedPermissions.includes(permissionType);
      
      console.warn(
        `[HealthPermissionUtils] Permission not granted for ${permissionType}`,
        `Status: ${permissionState.status}`,
        isDenied ? `Explicitly denied` : `Not determined`
      );
      
      return false;
    }
    
    console.log(`[HealthPermissionUtils] Permission granted for ${permissionType}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[HealthPermissionUtils] Error verifying ${permissionType} permission:`,
      errorMessage,
      error
    );
    
    // Throw a typed error for better error handling
    throw new HealthProviderPermissionError(
      permissionType,
      `Failed to verify permission: ${errorMessage}`
    );
  }
}

export function validatePermissionResponse(
  response: any,
  permissionType: string
): boolean {
  console.log(`[HealthPermissionUtils] Validating permission response for ${permissionType}`);
  
  if (!response || typeof response !== 'object') {
    console.error(
      `[HealthPermissionUtils] Invalid permission response for ${permissionType}:`,
      'Response is null or not an object'
    );
    return false;
  }

  if (typeof response.status !== 'string') {
    console.error(
      `[HealthPermissionUtils] Invalid permission response for ${permissionType}:`,
      'Missing or invalid status field'
    );
    return false;
  }

  return true;
}
