import { useState, useCallback, useEffect, useRef } from 'react';
import type { HealthProvider } from '../providers/health/types/provider';
import { metricsService } from '../services/metricsService';
import type { MetricType } from '../types/schemas';
import { isValidMetricValue } from '../utils/healthMetricUtils';

/**
 * Returns a user-friendly error message based on the error type
 */
const getUserFriendlyErrorMessage = (error: Error): string => {
  if (error.name === 'MetricsAuthError') {
    return 'Your session has expired. Please sign in again.';
  } else if (error.message.includes('permission')) {
    return 'Limited health data access. Some features may be unavailable.';
  } else if (error.message.includes('network') || error.message.includes('timeout')) {
    return 'Network error. Check your connection and try again.';
  } else {
    return error.message.includes('health') ? error.message :
      'Unable to sync health data. Please try again later.';
  }
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const isMounted = useRef(true);
  const isSyncInProgress = useRef(false);
  const syncAttempts = useRef(0);
  const lastSyncTimeRef = useRef(0);
  const MAX_SYNC_ATTEMPTS = 3;
  const MIN_SYNC_INTERVAL = 3000; // Minimum time between syncs in ms

  // Add safety timeout for loading state
  useEffect(() => {
    let mounted = true;
    const safetyTimer = setTimeout(() => {
      if (mounted && loading) {
        console.log('[useHealthData] Safety timeout triggered - resolving loading state');
        setLoading(false);
        setIsInitialized(true);
        isSyncInProgress.current = false;
      }
    }, 15000); // 15 seconds max loading time
    
    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
    };
  }, [loading]);

  const syncHealthData = useCallback(async () => {
    // Prevent concurrent syncs, too frequent syncs, and handle unmounting
    const now = Date.now();
    if (!isMounted.current || isSyncInProgress.current) {
      console.log('[useHealthData] Sync already in progress or component unmounted, skipping');
      return;
    }
    
    if (now - lastSyncTimeRef.current < MIN_SYNC_INTERVAL) {
      console.log('[useHealthData] Sync requested too soon after previous sync, skipping');
      return;
    }
    
    if (!userId) {
      setError(new Error('User ID is required to sync health data'));
      setLoading(false);
      return;
    }
    
    lastSyncTimeRef.current = now;
    isSyncInProgress.current = true;
    setLoading(true);
    setError(null);
    syncAttempts.current += 1;

    try {
      console.log('[useHealthData] Starting health data sync for user:', userId);
      
      // Add try/catch for each step
      try {
        await provider.initializeWithPermissions(userId);
      } catch (initError) {
        console.warn('[useHealthData] Provider initialization error:', initError);
        // Continue despite error - data might be partial but UI won't be stuck
      }
      
      // Check mount state before continuing
      if (!isMounted.current) return;
      
      // Check permission status with error fallback
      let permissionState;
      try {
        permissionState = await provider.checkPermissionsStatus();
      } catch (permError) {
        console.warn('[useHealthData] Permission check error:', permError);
        permissionState = { status: 'not_determined', lastChecked: Date.now() };
      }
      
      // Check mount state before continuing
      if (!isMounted.current) return;
      
      // If permissions aren't granted, request them
      if (permissionState.status !== 'granted') {
        console.log('[useHealthData] Requesting health permissions...');
        try {
          const granted = await provider.requestPermissions();
          
          // Check mount state before continuing
          if (!isMounted.current) return;
          
          // If user explicitly denied permissions, show useful error but don't block UI
          if (granted !== 'granted') {
            throw new Error(
              'Health permissions not granted. Some features may be limited.'
            );
          }
        } catch (permRequestError) {
          console.warn('[useHealthData] Permission request error:', permRequestError);
          // Continue with limited functionality
        }
      }

      // Fetch health data and update metrics
      console.log('[useHealthData] Permissions checked, fetching health data...');
      const healthData = await provider.getMetrics();
      
      // Check mount state before continuing
      if (!isMounted.current) return;
      
      // Only update specific health metrics
      const healthMetrics: MetricType[] = [
        'steps', 'distance', 'calories', 'heart_rate',
        'basal_calories', 'flights_climbed', 'exercise'
      ];
      
      // Update each health metric that has a value
      const failedMetrics: string[] = [];
      const updates = healthMetrics.map(async metric => {
        if (!isMounted.current) return;
        
        const value = healthData[metric];
        if (typeof value === 'number' && isValidMetricValue(value, metric)) {
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
        } else if (typeof value === 'number') {
          console.log(`[useHealthData] Skipping invalid ${metric} value: ${value}`);
        }
      });

      await Promise.all(updates);
      
      // Check mount state before continuing
      if (!isMounted.current) return;

      // If some metrics failed but not all, show a warning but don't fail completely
      if (failedMetrics.length > 0 && failedMetrics.length < healthMetrics.length) {
        console.warn(`[useHealthData] Some metrics failed to update: ${failedMetrics.join(', ')}`);
      }

      // Reset sync attempts on success
      syncAttempts.current = 0;
      
      console.log('[useHealthData] Health data sync completed successfully');

    } catch (err) {
      // Return early if component is unmounted
      if (!isMounted.current) return;
      
      // Determine if we should retry
      const shouldRetry = syncAttempts.current < MAX_SYNC_ATTEMPTS &&
                        !(err instanceof Error && err.message.includes('permissions not granted'));
      
      // Improved error handling with original error preservation
      const originalError = err instanceof Error ? err : new Error(String(err));
      const enhancedError = new Error(
        getUserFriendlyErrorMessage(originalError)
      );
      enhancedError.name = originalError.name;
      enhancedError.stack = originalError.stack;
      // @ts-ignore - Add originalError for debugging
      enhancedError.originalError = originalError;
      
      setError(enhancedError);
      console.error('[useHealthData] Health sync error:', err);
      
      // If we should retry, do so after a delay
      if (shouldRetry) {
        const retryDelay = Math.min(1000 * Math.pow(2, syncAttempts.current - 1), 8000);
        console.log(`[useHealthData] Will retry in ${retryDelay}ms (attempt ${syncAttempts.current})`);
        
        setTimeout(() => {
          if (isMounted.current) {
            isSyncInProgress.current = false;
            syncHealthData();
          }
        }, retryDelay);
        return;
      }
    } finally {
      // CRITICAL: Always complete loading state
      if (isMounted.current) {
        setLoading(false);
        setIsInitialized(true);
        isSyncInProgress.current = false;
      }
    }
  }, [provider, userId]);

  // Sync on mount and cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    isSyncInProgress.current = false;
    
    if (!userId) {
      console.warn('[useHealthData] No userId available - skipping sync');
      setLoading(false);
      setIsInitialized(true);
      return;
    }
    
    console.log('[useHealthData] Initializing health data for user:', userId);
    // Add a small delay to prevent rapid re-renders
    const timer = setTimeout(() => {
      if (isMounted.current && !isSyncInProgress.current) {
        syncHealthData();
      }
    }, 100);
    
    return () => {
      clearTimeout(timer);
      isMounted.current = false;
      if (provider.cleanup) {
        provider.cleanup().catch(err => {
          console.warn('[useHealthData] Error during cleanup:', err);
        });
      }
    };
  }, [syncHealthData, userId]);

  return { loading, error, syncHealthData, isInitialized };
};
