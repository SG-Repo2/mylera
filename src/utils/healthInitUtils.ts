import { HealthProviderFactory } from '../providers/health/factory/HealthProviderFactory';
import type { PermissionStatus } from '../providers/health/types/permissions';
import { mapAuthError } from './errorUtils';
import { supabase } from '../services/supabaseClient';

const MAX_INIT_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Delay utility for retry mechanism
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Initialize health provider for a given user and update permission status
 * Includes retry logic and enhanced error handling
 */
export async function initializeHealthProviderForUser(
  userId: string,
  setHealthStatus: (status: PermissionStatus) => void
): Promise<void> {
  let retries = 0;
  let lastError: Error | null = null;

  while (retries < MAX_INIT_RETRIES) {
    try {
      console.log(`[HealthProvider] Initialization attempt ${retries + 1}/${MAX_INIT_RETRIES} - Getting user's device type from Supabase`);
      // Get user's device type from Supabase
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('device_type')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error(`[HealthProvider] Initialization attempt ${retries + 1}/${MAX_INIT_RETRIES} - Error getting user data:`, userError);
        throw userError;
      }
      if (!userData) {
        console.error(`[HealthProvider] Initialization attempt ${retries + 1}/${MAX_INIT_RETRIES} - User profile not found`);
        throw new Error('User profile not found');
      }

      const deviceType = userData.device_type as 'os' | 'fitbit';
      
      console.log(`[HealthProvider] Initialization attempt ${retries + 1}/${MAX_INIT_RETRIES} - Device type:`, deviceType);
      // Initialize the appropriate provider based on device type
      const provider = HealthProviderFactory.getProvider(deviceType);
      console.log(`[HealthProvider] Initialization attempt ${retries + 1}/${MAX_INIT_RETRIES} - Initializing provider`);
      await provider.initialize();
      console.log(`[HealthProvider] Initialization attempt ${retries + 1}/${MAX_INIT_RETRIES} - Checking permissions status`);
      const permissionState = await provider.checkPermissionsStatus();
      
      // Log successful initialization
      console.log('[HealthProvider] Successfully initialized health provider');
      
      setHealthStatus(permissionState.status);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error during initialization');
      console.warn(
        `[HealthProvider] Initialization attempt ${retries + 1}/${MAX_INIT_RETRIES} failed:`,
        lastError.message
      );
      
      if (retries < MAX_INIT_RETRIES - 1) {
        await delay(RETRY_DELAY_MS);
      }
      retries++;
    }
  }

  // If we've exhausted all retries, log the error and set status to not_determined
  console.error(
    '[HealthProvider] Failed to initialize after multiple attempts:',
    lastError?.message
  );
  
  const errorMessage = lastError ? mapAuthError(lastError) : 'Failed to initialize health provider';
  console.error('[HealthProvider]', errorMessage);
  
  setHealthStatus('not_determined');
}
