import { useState, useCallback, useEffect } from 'react';
import { PermissionStatus } from '@/src/providers/health/types/permissions';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';
import { initializeHealthProviderForUser } from '@/src/utils/healthInitUtils';
import { standardizeError, ErrorCategory, logError } from '@/src/utils/errorUtils';

interface HealthPermissionsState {
  permissionStatus: PermissionStatus | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook for managing health permissions and data initialization
 * Separates health permissions logic from authentication
 */
export function useHealthPermissions(userId: string | null) {
  const [state, setState] = useState<HealthPermissionsState>({
    permissionStatus: null,
    isInitialized: false,
    isLoading: false,
    error: null,
  });

  /**
   * Initialize health provider for the user
   */
  const initializeHealthProvider = useCallback(async (force = false): Promise<PermissionStatus | null> => {
    if (!userId) {
      setState(prev => ({
        ...prev,
        permissionStatus: null,
        isInitialized: false,
        error: null,
      }));
      return null;
    }

    // Skip if already initialized and not forced
    if (state.isInitialized && !force) {
      return state.permissionStatus;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      // Initialize health provider and get permission status
      const provider = HealthProviderFactory.getProvider();
      
      // Create a promise that resolves with the permission status
      const status = await new Promise<PermissionStatus>((resolve) => {
        initializeHealthProviderForUser(userId, (permissionStatus: PermissionStatus) => {
          setState(prev => ({
            ...prev,
            permissionStatus: permissionStatus,
          }));
          resolve(permissionStatus);
        });
      });

      // Update state with initialization result
      setState(prev => ({
        ...prev,
        permissionStatus: status,
        isInitialized: true,
        isLoading: false,
      }));

      return status;
    } catch (error) {
      const standardError = standardizeError(error);
      logError('HealthPermissions', error);

      setState(prev => ({
        ...prev,
        error: standardError.message,
        isLoading: false,
        // Still mark as initialized to avoid blocking the UI
        isInitialized: true,
      }));

      return null;
    }
  }, [userId, state.isInitialized]);

  /**
   * Request health permissions from the user
   */
  const requestPermissions = useCallback(async (): Promise<PermissionStatus> => {
    if (!userId) {
      throw new Error('User must be logged in to request health permissions');
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    const PERMISSION_TIMEOUT = 6000; // 6 seconds

    try {
      const provider = HealthProviderFactory.getProvider();
      
      // Ensure provider is properly initialized
      await provider.initializeWithPermissions(userId);
      
      // Create timeout promise
      const timeoutPromise = new Promise<PermissionStatus>((resolve) => {
        setTimeout(() => {
          console.warn('[HealthPermissions] Permission request timed out');
          resolve('not_determined');
        }, PERMISSION_TIMEOUT);
      });
      
      // Race between permission request and timeout
      const status = await Promise.race([
        provider.requestPermissions(),
        timeoutPromise
      ]);
      
      console.log('[HealthPermissions] Permission request completed with status:', status);
      
      setState(prev => ({
        ...prev,
        permissionStatus: status,
        isInitialized: true,
        isLoading: false,
      }));
      
      // Try to fetch initial metrics if permissions granted
      if (status === 'granted') {
        try {
          await provider.getMetrics();
        } catch (metricsError) {
          console.warn('[HealthPermissions] Error loading metrics after permission grant:', metricsError);
        }
      }
      
      return status;
    } catch (error) {
      const standardError = standardizeError(error);
      logError('HealthPermissions', error);
      
      const status = 'denied' as PermissionStatus;
      setState(prev => ({
        ...prev,
        permissionStatus: status,
        error: standardError.message,
        isLoading: false,
        isInitialized: true,
      }));
      
      return status;
    }
  }, [userId]);

  /**
   * Check if health setup is needed
   */
  const needsHealthSetup = useCallback((): boolean => {
    return !state.permissionStatus || state.permissionStatus === 'not_determined';
  }, [state.permissionStatus]);

  /**
   * Clean up health provider resources
   */
  const cleanupHealthProvider = useCallback(async () => {
    try {
      const provider = HealthProviderFactory.getProvider();
      await provider.cleanup?.();
      
      setState({
        permissionStatus: null,
        isInitialized: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      logError('HealthPermissions', error, { context: 'cleanup' });
      console.warn('[HealthPermissions] Error during cleanup:', error);
    }
  }, []);

  // Initialize health provider when userId changes
  useEffect(() => {
    if (userId) {
      initializeHealthProvider();
    } else {
      // Reset state when logged out
      setState({
        permissionStatus: null,
        isInitialized: false,
        isLoading: false,
        error: null,
      });
    }
  }, [userId, initializeHealthProvider]);

  return {
    permissionStatus: state.permissionStatus,
    isInitialized: state.isInitialized,
    isLoading: state.isLoading,
    error: state.error,
    requestPermissions,
    initializeHealthProvider,
    needsHealthSetup,
    cleanupHealthProvider,
  };
} 