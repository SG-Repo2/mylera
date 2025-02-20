import { useState, useCallback, useEffect, useRef } from 'react';
import { debounce } from 'lodash';
import type { HealthProvider } from '../providers/health/types/provider';
import type { HealthMetrics } from '../providers/health/types/metrics';
import { withTimeout, DEFAULT_TIMEOUTS } from '../utils/timeoutUtils';
import { unifiedMetricsService } from '../services/unifiedMetricsService';
import { useAuth } from '../providers/AuthProvider';

/**
 * React hook for managing health data synchronization.
 * Handles initialization, permission management, and data fetching from platform-specific health providers.
 * 
 * @param provider - Platform-specific health provider instance (Apple HealthKit or Google Health Connect)
 * @param userId - Unique identifier of the user for permission management
 * @returns Object containing:
 *  - loading: Boolean indicating if a sync operation is in progress
 *  - error: Error object if the last operation failed, null otherwise
 *  - syncHealthData: Function to manually trigger a health data sync
 * 
 * @example
 * ```tsx
 * const { loading, error, syncHealthData } = useHealthData(healthProvider, userId);
 * 
 * // Handle loading state
 * if (loading) return <LoadingSpinner />;
 * 
 * // Handle error state
 * if (error) return <ErrorView error={error} />;
 * 
 * // Trigger manual sync
 * const handleRefresh = () => syncHealthData();
 * ```
 */
export const useHealthData = (provider: HealthProvider, userId: string) => {
  // Helper function to handle sync errors
  const handleSyncError = (err: unknown) => {
    let errorMessage: string;
    
    if (err instanceof Error) {
      if (err.name === 'MetricsAuthError') {
        errorMessage = 'Your session has expired. Please sign in again.';
      } else if (err.message.includes('permission')) {
        errorMessage = 'Unable to access health data. Please check your permissions in device settings.';
      } else if (err.message.includes('network') || err.message.includes('timeout')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else {
        errorMessage = err.message.includes('health') ? err.message :
          'Unable to sync health data. Please try again later.';
      }
    } else {
      errorMessage = 'An unexpected error occurred. Please try again.';
    }
    
    setError(new Error(errorMessage));
    console.error('[useHealthData] Health sync error:', err);
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);
  const syncInProgress = useRef(false);
  const { healthInitState } = useAuth();

  // Create debounced version of sync function with error handling
  const debouncedSync = useCallback(
    debounce(async () => {
      if (!isMounted.current || syncInProgress.current) return;
      
      syncInProgress.current = true;
      setLoading(true);
      setError(null);

      try {
        // Only proceed if provider is properly initialized
        if (!healthInitState.isInitialized) {
          console.log('[useHealthData] Provider not initialized, skipping sync');
          return;
        }

        console.log('[useHealthData] Permissions granted, fetching health data...');
        // Get health data with timeout using unifiedMetricsService
        await withTimeout(
          unifiedMetricsService.getMetrics(userId, undefined, provider),
          DEFAULT_TIMEOUTS.METRICS_FETCH,
          'Health metrics fetch timed out'
        );

      } catch (err) {
        handleSyncError(err);
      } finally {
        if (isMounted.current) {
          setLoading(false);
          syncInProgress.current = false;
        }
      }
    }, 800),
    [provider, userId, healthInitState.isInitialized]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      debouncedSync.cancel();
      if (provider) {
        provider.cleanup().catch(error => {
          console.error('[useHealthData] Error during cleanup:', error);
        });
      }
    };
  }, [debouncedSync, provider]);

  const syncHealthData = useCallback(() => {
    if (!isMounted.current || syncInProgress.current) return;
    debouncedSync();
  }, [debouncedSync]);

  // Initial sync
  useEffect(() => {
    if (!userId) {
      console.warn('useHealthData: No userId available - skipping sync');
      setLoading(false);
      return;
    }
    
    syncHealthData();
  }, [syncHealthData, userId]);

  return { loading, error, syncHealthData, isInitialized: healthInitState.isInitialized };
};
