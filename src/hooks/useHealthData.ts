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
 * @param userId - Unique identifier of the user for permission management
 * @param deviceType - Optional device type ('os' or 'fitbit')
 * @returns Object containing:
 *  - loading: Boolean indicating if a sync operation is in progress
 *  - error: Error object if the last operation failed, null otherwise
 *  - syncHealthData: Function to manually trigger a health data sync
 *  - isInitialized: Boolean indicating if the provider has been successfully initialized
 *  - provider: The initialized health provider instance
 * 
 * @example
 * ```tsx
 * const { loading, error, syncHealthData, isInitialized, provider } = useHealthData(userId, deviceType);
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
export const useHealthData = (userId: string, deviceType?: 'os' | 'fitbit') => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [provider, setProvider] = useState<HealthProvider | null>(null);
  const isMounted = useRef(true);
  const syncInProgress = useRef(false);

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

  const initializeProvider = useCallback(async () => {
    if (!isMounted.current) return false;

    try {
      setLoading(true);
      console.log('[useHealthData] Fetching health provider for user:', userId);
      
      // Clean up existing provider
      await HealthProviderFactory.cleanup();
      console.log('[useHealthData] Provider cleanup complete');
      
      // Get a fresh provider instance
      const newProvider = await HealthProviderFactory.getProvider(deviceType, userId);
      console.log('[useHealthData] New provider instance created');
      
      // Validate and initialize new provider
      validateProviderInitialization(newProvider);
      console.log('[useHealthData] New provider validation successful');
      
      await withTimeout(
        initializeWithRetry(newProvider),
        DEFAULT_TIMEOUTS.INITIALIZATION,
        'Health provider initialization timed out'
      );
      
      // Set provider and initialize state
      setProvider(newProvider);
      setIsInitialized(true);
      setError(null);
      console.log('[useHealthData] Provider initialization successful');
      return true;
    } catch (error) {
      console.error('[useHealthData] Provider initialization failed:', error);
      setError(error instanceof Error ? error : new Error('Failed to initialize health provider'));
      setIsInitialized(false);
      return false;
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [userId, deviceType]);

  // Create debounced version of sync function with error handling
  const debouncedSync = useCallback(
    debounce(async () => {
      if (!isMounted.current || syncInProgress.current || !provider) return;
      
      syncInProgress.current = true;
      setLoading(true);
      setError(null);

      try {
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
    [provider, userId, updateHealthMetrics, handleSyncError]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      debouncedSync.cancel();
      HealthProviderFactory.cleanup().catch(error => {
        console.error('[useHealthData] Error during cleanup:', error);
      });
    };
  }, [debouncedSync]);

  // Initialize provider effect
  useEffect(() => {
    if (!userId) {
      console.warn('[useHealthData] No userId available - skipping initialization');
      setLoading(false);
      return;
    }
    
    initializeProvider();
  }, [userId, deviceType, initializeProvider]);

  const syncHealthData = useCallback(() => {
    if (!isMounted.current || syncInProgress.current || !provider) return;
    debouncedSync();
  }, [debouncedSync, provider]);

  return { 
    loading, 
    error, 
    syncHealthData, 
    isInitialized,
    provider 
  };
};
