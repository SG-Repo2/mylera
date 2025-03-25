import { PermissionStatus, getPermissionCacheKey } from '@/src/providers/health/types/permissions';
import { initializeHealthProviderForUser } from '@/src/utils/healthInitUtils';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HealthProvider } from '@/src/providers/health/types/provider';

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
    await initializeHealthProviderForUser(
      userId, 
      setHealthPermissionStatus || (() => {})
    );
    
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
 * Initialize health provider with permission verification
 * This wrapper ensures permissions are verified on every initialization,
 * especially after app reinstallation
 */
export async function initializeHealthProviderWithPermissionVerification(
  userId: string,
  deviceType?: 'os' | 'fitbit',
  setHealthStatus?: (status: PermissionStatus) => void
): Promise<HealthProvider> {
  try {
    // First, force clear any stale permission cache
    const cacheKey = getPermissionCacheKey(userId);
    await AsyncStorage.removeItem(cacheKey);
    
    console.log('[healthIntegration] Initializing provider with fresh permission check');
    
    // Get the provider using the factory
    const provider = HealthProviderFactory.getProvider(deviceType);
    
    // Safely initialize the provider
    const status = await provider.safeInitialize(userId);
    console.log(`[healthIntegration] Provider initialized with permission status: ${status}`);
    
    // Update status if callback provided
    if (setHealthStatus) {
      setHealthStatus(status);
    }

    // If permissions not granted, force explicit request
    if (status !== 'granted') {
      console.log('[healthIntegration] Permissions not granted, requesting explicitly');
      const requestStatus = await provider.requestPermissions();
      
      if (setHealthStatus) {
        setHealthStatus(requestStatus);
      }
      
      // Log permission request result
      console.log(`[healthIntegration] Permission request result: ${requestStatus}`);
    }

    return provider;
  } catch (error) {
    console.error('[healthIntegration] Error initializing health provider:', error);
    
    // Update status to not_determined on error
    if (setHealthStatus) {
      setHealthStatus('not_determined');
    }
    
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
    const timeoutPromise = new Promise<PermissionStatus>((resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn('[healthIntegration] Permission request timed out after', timeoutMs, 'ms');
        resolve('not_determined');
      }, timeoutMs);
      
      // Cleanup timeout if promise is completed before timeout
      return () => clearTimeout(timeoutId);
    });
    
    // Race between permission request and timeout
    const status = await Promise.race([
      provider.requestPermissions(),
      timeoutPromise
    ]);
    
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