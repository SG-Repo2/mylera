import { useState, useCallback, useEffect, useRef } from 'react';
import type { HealthProvider } from '../providers/health/types/provider';
import { metricsService } from '../services/metricsService';
import type { MetricType } from '../types/schemas';
import { initializeHealthProviderForUser } from '../utils/healthInitUtils';
import {
  HealthProviderFactory,
  HealthErrorCode,
  type HealthPlatform,
} from '../providers/health/factory/HealthProviderFactory';
import { supabase } from '../services/supabaseClient';

interface HealthProviderError extends Error {
  code: HealthErrorCode;
  details?: Record<string, unknown>;
}

function isHealthProviderError(error: unknown): error is HealthProviderError {
  return (
    error instanceof Error &&
    'code' in error &&
    Object.values(HealthErrorCode).includes((error as any).code)
  );
}

export type LoadingState = 'idle' | 'initializing' | 'requesting_permissions' | 'syncing' | 'error';

/**
 * React hook for managing health data synchronization.
 * Handles initialization, permission management, and data fetching from platform-specific health providers.
 * Uses HealthProviderFactory to manage provider lifecycle and permissions.
 *
 * @param userId - Unique identifier of the user for permission management
 * @returns Object containing:
 *  - loading: Boolean indicating if any operation is in progress (backward compatibility)
 *  - loadingState: Detailed state of the current operation ('idle' | 'initializing' | 'requesting_permissions' | 'syncing' | 'error')
 *  - error: Error object if the last operation failed, null otherwise
 *  - syncHealthData: Function to manually trigger a health data sync
 *  - isInitialized: Boolean indicating if the health provider is fully initialized
 *  - provider: Current HealthProvider instance or null if not initialized
 *
 * @example
 * ```tsx
 * const { loadingState, error, syncHealthData } = useHealthData(userId);
 *
 * // Handle different loading states
 * switch (loadingState) {
 *   case 'initializing':
 *     return <LoadingSpinner message="Initializing health services..." />;
 *   case 'requesting_permissions':
 *     return <LoadingSpinner message="Requesting health permissions..." />;
 *   case 'syncing':
 *     return <LoadingSpinner message="Syncing health data..." />;
 *   case 'error':
 *     return <ErrorView error={error} />;
 * }
 *
 * // Trigger manual sync
 * const handleRefresh = () => syncHealthData();
 * ```
 */
export const useHealthData = (userId: string) => {
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const isMounted = useRef(true);
  const providerRef = useRef<HealthProvider | null>(null);

  const syncHealthData = useCallback(async () => {
    if (!isMounted.current) return;

    setLoadingState('initializing');
    setError(null);

    try {
      // Use the enhanced initialization flow
      await initializeHealthProviderForUser(userId, status => {
        if (status === 'not_determined') {
          setLoadingState('requesting_permissions');
        }
      });

      // Get the initialized provider
      const { data: userData } = await supabase
        .from('user_profiles')
        .select('device_type')
        .eq('id', userId)
        .single();

      if (!userData) {
        throw new Error('User profile not found');
      }

      const deviceType = userData.device_type as 'os' | 'fitbit';
      providerRef.current = await HealthProviderFactory.getProvider(deviceType, userId);

      setLoadingState('syncing');
      console.log('[useHealthData] Permissions granted, fetching health data...');

      if (!providerRef.current) {
        throw new Error('Health provider not initialized');
      }

      const healthData = await providerRef.current.getMetrics();

      // Only update specific health metrics
      const healthMetrics: MetricType[] = [
        'steps',
        'distance',
        'calories',
        'heart_rate',
        'basal_calories',
        'flights_climbed',
        'exercise',
      ];

      // Update each health metric that has a value
      const failedMetrics: string[] = [];
      const updates = healthMetrics.map(async metric => {
        const value = healthData[metric];
        if (typeof value === 'number') {
          try {
            await metricsService.updateMetric(userId, metric, value);
          } catch (err) {
            // If it's an auth error, stop processing immediately
            if (err instanceof Error && err.name === 'MetricsAuthError') {
              throw err;
            }
            // For other errors, track the failed metric but continue processing
            console.error(`[useHealthData] Error updating metric ${metric}:`, err);
            failedMetrics.push(metric);
          }
        }
      });

      await Promise.all(updates);

      // If some metrics failed but not all, show a warning but don't fail completely
      if (failedMetrics.length > 0 && failedMetrics.length < healthMetrics.length) {
        console.warn(`[useHealthData] Some metrics failed to update: ${failedMetrics.join(', ')}`);
      }
    } catch (err) {
      setLoadingState('error');
      console.error('[useHealthData] Health sync error:', err);

      // Handle HealthProviderError with specific error codes
      if (isHealthProviderError(err)) {
        const platform = HealthProviderFactory.getPlatform();
        const platformName =
          platform === 'apple'
            ? 'Apple Health'
            : platform === 'google'
              ? 'Google Health Connect'
              : 'Fitbit';

        switch (err.code) {
          case HealthErrorCode.INITIALIZATION_FAILED:
            setError(
              new Error(
                `Unable to initialize ${platformName}. Please check your device settings and try again.`
              )
            );
            break;
          case HealthErrorCode.PROVIDER_NOT_INITIALIZED:
            setError(
              new Error(`${platformName} is not properly initialized. Please restart the app.`)
            );
            break;
          case HealthErrorCode.INITIALIZATION_IN_PROGRESS:
            setError(new Error(`${platformName} is still initializing. Please wait...`));
            break;
          case HealthErrorCode.UNSUPPORTED_PLATFORM:
            setError(new Error(`${platformName} is not supported on your device.`));
            break;
          case HealthErrorCode.CLEANUP_FAILED:
            setError(
              new Error(`Failed to cleanup ${platformName} connection. Please restart the app.`)
            );
            break;
          default:
            setError(new Error(err.message));
        }

        // Log detailed error information for debugging
        console.error('[useHealthData] Health provider error:', {
          code: err.code,
          message: err.message,
          details: err.details,
          platform,
        });
      } else if (err instanceof Error) {
        if (err.name === 'MetricsAuthError') {
          setError(new Error('Your session has expired. Please sign in again.'));
        } else if (err.message.includes('network') || err.message.includes('timeout')) {
          setError(new Error('Network error. Please check your connection and try again.'));
        } else if (err.message.includes('permission')) {
          setError(
            new Error(
              'Unable to access health data. Please check your permissions in device settings.'
            )
          );
        } else {
          setError(new Error(err.message));
        }
      } else {
        setError(new Error('An unexpected error occurred. Please try again.'));
      }
    } finally {
      if (isMounted.current) {
        setLoadingState('idle');
        setIsInitialized(true);
      }
    }
  }, [userId]);

  // Sync on mount and cleanup on unmount
  useEffect(() => {
    isMounted.current = true;

    if (!userId) {
      console.warn('useHealthData: No userId available - skipping sync');
      setLoadingState('idle');
      setIsInitialized(true);
      return;
    }

    syncHealthData();

    return () => {
      isMounted.current = false;
      if (providerRef.current?.cleanup) {
        providerRef.current.cleanup();
      }
    };
  }, [syncHealthData, userId]);

  // Compute loading boolean for backward compatibility
  const loading = loadingState !== 'idle';

  return {
    loading,
    loadingState,
    error,
    syncHealthData,
    isInitialized,
    provider: providerRef.current, // Expose provider for components that need direct access
  };
};
