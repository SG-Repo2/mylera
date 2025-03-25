import { PermissionStatus } from '@/src/providers/health/types/permissions';
import { initializeHealthProviderForUser } from '@/src/utils/healthInitUtils';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';

/**
 * Initialize health provider for a user and request permissions
 */
export async function initializeHealthProvider(
  userId: string,
  deviceType?: 'os' | 'fitbit',
  setHealthPermissionStatus?: (status: PermissionStatus) => void
) {
  console.log('[healthIntegration] Initializing health provider...');

  try {
    // Initialize provider with user ID
    await initializeHealthProviderForUser(userId, setHealthPermissionStatus || (() => {}));

    // Get the initialized provider
    const provider = HealthProviderFactory.getProvider(deviceType);
    console.log('[healthIntegration] Health provider initialized successfully');

    return provider;
  } catch (error) {
    console.error('[healthIntegration] Error initializing health provider:', error);
    throw error;
  }
}

/**
 * Request health permissions with timeout protection
 */
export async function requestHealthPermissionsWithTimeout(
  userId: string,
  timeoutMs: number = 6000
): Promise<PermissionStatus> {
  console.log('[healthIntegration] Requesting health permissions with timeout...');

  try {
    const provider = HealthProviderFactory.getProvider();

    // Ensure provider is properly initialized
    await provider.initializeWithPermissions(userId);

    // Create timeout promise
    const timeoutPromise = new Promise<PermissionStatus>(resolve => {
      const timeoutId = setTimeout(() => {
        console.warn('[healthIntegration] Permission request timed out after', timeoutMs, 'ms');
        resolve('not_determined');
      }, timeoutMs);

      // Cleanup timeout if promise is completed before timeout
      return () => clearTimeout(timeoutId);
    });

    // Race between permission request and timeout
    const status = await Promise.race([provider.requestPermissions(), timeoutPromise]);

    console.log('[healthIntegration] Permission request completed with status:', status);
    return status;
  } catch (error) {
    console.error('[healthIntegration] Error requesting health permissions:', error);
    return 'denied';
  }
}

/**
 * Check if health setup is needed
 */
export function needsHealthSetup(permissionStatus: PermissionStatus | null): boolean {
  return !permissionStatus || permissionStatus === 'not_determined';
}

/**
 * Clean up health provider resources
 */
export async function cleanupHealthProvider() {
  try {
    const provider = HealthProviderFactory.getProvider();
    await provider.cleanup?.();
    console.log('[healthIntegration] Health provider cleaned up successfully');
  } catch (error) {
    console.error('[healthIntegration] Error cleaning up health provider:', error);
  }
}

/**
 * Fetch initial metrics to initialize health data
 */
export async function fetchInitialHealthMetrics() {
  try {
    const provider = HealthProviderFactory.getProvider();
    const metrics = await provider.getMetrics();
    console.log('[healthIntegration] Initial metrics fetched successfully');
    return metrics;
  } catch (error) {
    console.warn('[healthIntegration] Error fetching initial health metrics:', error);
    throw error;
  }
}
