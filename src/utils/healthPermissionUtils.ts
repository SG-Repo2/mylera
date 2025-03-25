import type { BaseHealthProvider } from '../providers/health/types/provider';
import { logger, LogCategory } from './logger';

export async function verifyHealthPermission(
  provider: BaseHealthProvider,
  permissionType: string
): Promise<boolean> {
  try {
    const permissionState = await provider.checkPermissionsStatus();

    if (permissionState.status !== 'granted') {
      logger.warn(
        LogCategory.Health,
        `[HealthPermissionUtils] Permission not granted for ${permissionType}`
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error(
      LogCategory.Health,
      `[HealthPermissionUtils] Error verifying permission for ${permissionType}:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
    return false;
  }
}
