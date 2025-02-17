import {
  HealthProviderFactory,
  HealthErrorCode,
} from '../providers/health/factory/HealthProviderFactory';
import type { PermissionStatus } from '../providers/health/types/permissions';
import { mapAuthError, mapHealthProviderError } from './errorUtils';
import { supabase } from '../services/supabaseClient';

/**
 * Initialize health provider for a given user and update permission status
 * Uses HealthProviderFactory's built-in retry logic and error handling
 */
export async function initializeHealthProviderForUser(
  userId: string,
  setHealthStatus: (status: PermissionStatus) => void
): Promise<void> {
  try {
    // Get user's device type from Supabase
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('device_type')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('[HealthProvider] Error fetching user profile:', userError);
      throw new Error(mapAuthError(userError));
    }

    if (!userData) {
      console.warn('[HealthProvider] User profile not found');
      setHealthStatus('not_determined');
      throw new Error('User profile not found. Please complete your profile setup.');
    }

    const deviceType = userData.device_type as 'os' | 'fitbit';

    // Use the enhanced HealthProviderFactory to get and initialize the provider
    const provider = await HealthProviderFactory.getProvider(deviceType, userId);

    // Check permissions status after initialization
    const permissionState = await provider.checkPermissionsStatus();
    console.log('[HealthProvider] Successfully initialized health provider');

    setHealthStatus(permissionState.status);

    // If permissions aren't granted, request them
    if (permissionState.status !== 'granted') {
      console.log('[HealthProvider] Requesting health permissions...');
      const newStatus = await provider.requestPermissions();
      setHealthStatus(newStatus);
    }
  } catch (error) {
    console.error('[HealthProvider] Error during health provider initialization:', error);

    // Map the error to a user-friendly message based on the platform
    const platform = HealthProviderFactory.getPlatform();
    const errorMessage =
      error instanceof Error
        ? mapHealthProviderError(error, platform)
        : 'Failed to initialize health provider';

    console.error('[HealthProvider]', errorMessage);
    setHealthStatus('not_determined');
    throw new Error(errorMessage);
  }
}
