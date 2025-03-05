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
  const MAX_SYNC_ATTEMPTS = 3;
  const initAttempts = useRef(0);
  const MAX_INIT_ATTEMPTS = 3;
  const lastSyncTimeRef = useRef(0);
  const MIN_SYNC_INTERVAL = 3000; // Minimum 3 seconds between syncs

  const syncHealthData = useCallback(async () => {
    // Prevent concurrent syncs and handle unmounting
    if (!isMounted.current || isSyncInProgress.current) {
      console.log('[useHealthData] Sync skipped - not mounted or sync in progress');
      return;
    }
    
    // Check for minimum time between syncs to prevent unnecessary operations
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;
    if (timeSinceLastSync < MIN_SYNC_INTERVAL && isInitialized) {
      console.log(`[useHealthData] Sync skipped - too soon (${timeSinceLastSync}ms since last sync)`);
      return;
    }
    
    if (!userId) {
      setError(new Error('User ID is required to sync health data'));
      setLoading(false);
      return;
    }
    
    isSyncInProgress.current = true;
    setLoading(true);
    setError(null);
    syncAttempts.current += 1;
    lastSyncTimeRef.current = now;
    
    console.log(`[useHealthData] Starting health data sync (attempt ${syncAttempts.current})`);

    try {
      // Use the atomic initialization with permissions
      await provider.initializeWithPermissions(userId);
      
      // Check mount state before continuing
      if (!isMounted.current) return;
      
      // Check permission status
      const permissionState = await provider.checkPermissionsStatus();
      
      // Check mount state before continuing
      if (!isMounted.current) return;
      
      // If permissions aren't granted, request them
      if (permissionState.status !== 'granted') {
        console.log('[useHealthData] Requesting health permissions...');
        const granted = await provider.requestPermissions();
        
        // Check mount state before continuing
        if (!isMounted.current) return;
        
        // If user explicitly denied permissions, show useful error but don't block UI
        if (granted !== 'granted') {
          // Set error but still continue to show UI with limited functionality
          throw new Error(
            'Health permissions not granted. Some features may be limited.'
          );
        }
      }

      // Fetch health data and update metrics
      console.log('[useHealthData] Permissions granted, fetching health data...');
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
      const successfulUpdates: string[] = [];
      const updates = healthMetrics.map(async metric => {
        if (!isMounted.current) return;
        
        const value = healthData[metric];
        if (typeof value === 'number' && isValidMetricValue(value, metric)) {
          try {
            await metricsService.updateMetric(userId, metric, value);
            successfulUpdates.push(metric);
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

      // Log successful updates
      if (successfulUpdates.length > 0) {
        console.log(`[useHealthData] Successfully updated metrics: ${successfulUpdates.join(', ')}`);
      }

      // If some metrics failed but not all, show a warning but don't fail completely
      if (failedMetrics.length > 0 && failedMetrics.length < healthMetrics.length) {
        console.warn(`[useHealthData] Some metrics failed to update: ${failedMetrics.join(', ')}`);
      }

      // Reset sync attempts on success
      syncAttempts.current = 0;

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
        setTimeout(() => {
          if (isMounted.current) {
            isSyncInProgress.current = false;
            syncHealthData();
          }
        }, 1000);
        return;
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsInitialized(true);
        isSyncInProgress.current = false;
      }
    }
  }, [provider, userId, isInitialized]);

  // Sync on mount and cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    isSyncInProgress.current = false;
    
    if (!userId) {
      console.warn('useHealthData: No userId available - skipping sync');
      setLoading(false);
      setIsInitialized(true);
      return;
    }
    
    syncHealthData();
    
    return () => {
      isMounted.current = false;
      if (provider.cleanup) {
        provider.cleanup();
      }
    };
  }, [syncHealthData, userId]);

  return { loading, error, syncHealthData, isInitialized };
};
