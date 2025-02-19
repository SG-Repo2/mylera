import { useState, useCallback, useEffect, useRef } from 'react';
import { debounce } from 'lodash';
import type { HealthProvider } from '../providers/health/types/provider';
import type { HealthMetrics } from '../providers/health/types/metrics';
import { withTimeout, DEFAULT_TIMEOUTS } from '../utils/timeoutUtils';
import { metricsService } from '../services/metricsService';
import type { MetricType } from '../types/schemas';
import { validateProviderInitialization, initializeWithRetry } from '../utils/healthInitUtils';
import { HealthProviderFactory } from '../providers/health/factory/HealthProviderFactory';

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
  // Helper function to update health metrics
  const updateHealthMetrics = async (healthData: HealthMetrics) => {
    const healthMetrics: MetricType[] = [
      'steps',
      'distance',
      'calories',
      'heart_rate',
      'basal_calories',
      'flights_climbed',
      'exercise'
    ];
    
    let failedMetrics: string[] = [];
    const updates = healthMetrics.map(async metric => {
      const value = healthData[metric];
      if (typeof value === 'number') {
        try {
          await metricsService.updateMetric(userId, metric, value);
        } catch (err) {
          if (err instanceof Error && err.name === 'MetricsAuthError') {
            throw err;
          }
          console.error(`[useHealthData] Error updating metric ${metric}:`, err);
          failedMetrics.push(metric);
        }
      }
    });

    await Promise.all(updates);

    if (failedMetrics.length > 0 && failedMetrics.length < healthMetrics.length) {
      console.warn(`[useHealthData] Some metrics failed to update: ${failedMetrics.join(', ')}`);
    }
  };

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
  const [isInitialized, setIsInitialized] = useState(false);
  const isMounted = useRef(true);
  const syncInProgress = useRef(false);

  const retryInitialization = useCallback(async () => {
    if (!isMounted.current) return false;

    try {
      console.log('[useHealthData] Attempting provider initialization retry...');
      
      // Clean up existing provider
      await HealthProviderFactory.cleanup();
      console.log('[useHealthData] Provider cleanup complete');
      
      // Get a fresh provider instance
      const newProvider = await HealthProviderFactory.getProvider();
      console.log('[useHealthData] New provider instance created');
      
      // Validate and initialize new provider
      validateProviderInitialization(newProvider);
      console.log('[useHealthData] New provider validation successful');
      
      await withTimeout(
        initializeWithRetry(newProvider),
        DEFAULT_TIMEOUTS.INITIALIZATION,
        'Health provider initialization timed out'
      );
      
      console.log('[useHealthData] Provider initialization retry successful');
      return true;
    } catch (error) {
      console.error('[useHealthData] Provider initialization retry failed:', error);
      return false;
    }
  }, [isMounted]);

  // Create debounced version of sync function with error handling
  const debouncedSync = useCallback(
    debounce(async () => {
      if (!isMounted.current || syncInProgress.current) return;
      
      syncInProgress.current = true;
      setLoading(true);
      setError(null);

      try {
        // Initialize and validate provider
        try {
          console.log('[useHealthData] Starting provider initialization...');
          
          // First ensure we have a valid provider instance
          validateProviderInitialization(provider);
          console.log('[useHealthData] Provider validation successful');
          
          // Then initialize it with timeout and retries
          await withTimeout(
            initializeWithRetry(provider),
            DEFAULT_TIMEOUTS.INITIALIZATION,
            'Health provider initialization timed out'
          );
          
          setIsInitialized(true);
          console.log('[useHealthData] Provider initialized successfully');
        } catch (err) {
          // If initial initialization fails, try one retry
          console.log('[useHealthData] Initial initialization failed, attempting retry...');
          const retrySuccessful = await retryInitialization();
          if (!retrySuccessful) {
            throw err;
          }
          setIsInitialized(true);
          console.log('[useHealthData] Initialization retry succeeded');
        }

        // Initialize permissions with timeout
        try {
          console.log('[useHealthData] Initializing permissions for user:', userId);
          await withTimeout(
            provider.initializePermissions(userId),
            DEFAULT_TIMEOUTS.INITIALIZATION,
            'Permission initialization timed out'
          );
          console.log('[useHealthData] Permissions initialized successfully');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.error('[useHealthData] Permission initialization failed:', message);
          
          // Try to clean up on permission failure
          try {
            await HealthProviderFactory.cleanup();
          } catch (cleanupError) {
            console.warn('[useHealthData] Cleanup after permission failure failed:', cleanupError);
          }
          
          throw err;
        }

        // Check permissions with timeout
        const permissionState = await withTimeout(
          provider.checkPermissionsStatus(),
          DEFAULT_TIMEOUTS.PERMISSION_CHECK,
          'Permission check timed out'
        );

        if (permissionState.status !== 'granted') {
          console.log('[useHealthData] Requesting health permissions...');
          const granted = await withTimeout(
            provider.requestPermissions(),
            DEFAULT_TIMEOUTS.PERMISSION_CHECK,
            'Permission request timed out'
          );
          if (granted !== 'granted') {
            throw new Error(
              'Health permissions are required to track your fitness metrics. ' +
              'Please grant permissions in your device settings.'
            );
          }
        }

        console.log('[useHealthData] Permissions granted, fetching health data...');
        // Get health data with timeout
        const healthData = await withTimeout(
          provider.getMetrics(),
          DEFAULT_TIMEOUTS.METRICS_FETCH,
          'Health metrics fetch timed out'
        );
        
        // Update metrics with timeout
        await withTimeout(
          updateHealthMetrics(healthData),
          DEFAULT_TIMEOUTS.SYNC,
          'Metrics update timed out'
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
    [provider, userId, retryInitialization]
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

  return { loading, error, syncHealthData, isInitialized };
};
