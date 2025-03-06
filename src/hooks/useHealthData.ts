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
  const syncResultsRef = useRef({
    lastSuccessTime: 0,
    metricUpdatesCount: 0,
    failuresCount: 0
  });

  const syncHealthData = useCallback(async () => {
    // Set initialized immediately to ensure the UI is responsive
    if (!isInitialized) {
      setIsInitialized(true);
    }
    
    // Prevent concurrent syncs and handle unmounting
    if (!isMounted.current || isSyncInProgress.current) {
      console.log('[useHealthData] Sync skipped - not mounted or sync in progress');
      return false; // Return false to indicate sync did not happen
    }
    
    // Check for minimum time between syncs to prevent unnecessary operations
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;
    if (timeSinceLastSync < MIN_SYNC_INTERVAL && isInitialized) {
      console.log(`[useHealthData] Sync skipped - too soon (${timeSinceLastSync}ms since last sync)`);
      return false; // Return false to indicate sync did not happen
    }
    
    if (!userId) {
      setError(new Error('User ID is required to sync health data'));
      setLoading(false);
      return false; // Return false to indicate sync did not happen
    }
    
    isSyncInProgress.current = true;
    setLoading(true);
    setError(null);
    syncAttempts.current += 1;
    lastSyncTimeRef.current = now;
    
    console.log(`[useHealthData] Starting health data sync (attempt ${syncAttempts.current})`);

    try {
      try {
        // Use the atomic initialization with permissions with a more robust timeout handling
        await Promise.race([
          provider.initializeWithPermissions(userId),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health provider initialization timeout')), 10000) // Increased timeout to 10s
          )
        ]);
      } catch (initError) {
        console.error('[useHealthData] Provider initialization error:', initError);
        // Set initialized to true anyway to ensure the UI shows rather than getting stuck
        setIsInitialized(true);
        // Also set loading to false to prevent infinite loading
        setLoading(false);
        // For other issues, we'll continue and let the UI show without health data
        setError(initError instanceof Error ? initError : new Error('Health provider initialization failed'));
        isSyncInProgress.current = false;
        return false; // Return false to indicate sync did not complete
      }
      
      // Check mount state before continuing
      if (!isMounted.current) return false;
      
      // Check permission status
      const permissionState = await provider.checkPermissionsStatus();
      
      // Check mount state before continuing
      if (!isMounted.current) return false;
      
      // If permissions aren't granted, request them
      if (permissionState.status !== 'granted') {
        console.log('[useHealthData] Requesting health permissions...');
        const granted = await provider.requestPermissions();
        
        // Check mount state before continuing
        if (!isMounted.current) return;
        
        // If user explicitly denied permissions, show useful error but don't block UI
        if (granted !== 'granted') {
          // Set isInitialized to true anyway to ensure the UI shows
          setIsInitialized(true);
          // Also set loading to false to prevent infinite loading
          setLoading(false);
          // Set error but still continue to show UI with limited functionality
          setError(new Error('Health permissions not granted. Some features may be limited.'));
          isSyncInProgress.current = false;
          return;
        }
      }

      // Fetch health data and update metrics
      console.log('[useHealthData] Permissions granted, fetching health data...');
      let healthData;
      try {
        healthData = await provider.getMetrics();
      } catch (metricError) {
        console.error('[useHealthData] Error fetching metrics:', metricError);
        // Still mark as initialized so UI can show
        setIsInitialized(true);
        // Also set loading to false
        setLoading(false);
        // Set error instead of throwing
        setError(metricError instanceof Error ? metricError : new Error('Failed to fetch health metrics'));
        isSyncInProgress.current = false;
        return;
      }
      
      // Check mount state before continuing
      if (!isMounted.current) return;
      
      // Mark as initialized after we've gotten health metrics
      if (!isInitialized) {
        console.log('[useHealthData] Provider successfully initialized');
        setIsInitialized(true);
      }
      
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
      
      // Update sync results stats
      syncResultsRef.current.lastSuccessTime = Date.now();
      syncResultsRef.current.metricUpdatesCount += successfulUpdates.length;
      syncResultsRef.current.failuresCount += failedMetrics.length;
      
      // Log sync status
      console.log(`[useHealthData] Sync complete - Updated: ${successfulUpdates.join(', ')} - Failed: ${failedMetrics.length > 0 ? failedMetrics.join(', ') : 'none'}`);
      
      // Reset error state on successful sync
      setError(null);
      syncAttempts.current = 0;
    } catch (err) {
      // Preserve original error information
      const originalError = err instanceof Error ? err : new Error('Unknown error during health sync');
      
      // Create a user-friendly message
      const userMessage = getUserFriendlyErrorMessage(originalError);
      
      console.error('[useHealthData] Sync error:', originalError.message);
      
      // Determine if we should retry based on error type
      const isRetryableError = 
        !originalError.message.includes('permission') && 
        !originalError.name.includes('Auth') &&
        syncAttempts.current < MAX_SYNC_ATTEMPTS;
      
      if (isRetryableError) {
        console.log(`[useHealthData] Retryable error, will attempt again later (attempt ${syncAttempts.current}/${MAX_SYNC_ATTEMPTS})`);
      } else {
        // Only set the error on the final attempt or for non-retryable errors
        setError(Object.assign(originalError, { userMessage }));
        syncResultsRef.current.failuresCount += 1;
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isSyncInProgress.current = false;
      }
    }
  }, [provider, userId, isInitialized]);

  // Sync on mount and cleanup on unmount
  useEffect(() => {
    // Always set these flags immediately
    isMounted.current = true;
    isSyncInProgress.current = false;
    
    // Set initialized immediately so UI can render
    setIsInitialized(true);
    
    if (!userId) {
      console.warn('useHealthData: No userId available - skipping sync');
      setLoading(false);
      return;
    }
    
    // Use a timeout to give the UI a chance to render first
    const timer = setTimeout(() => {
      if (isMounted.current) {
        syncHealthData();
      }
    }, 100);
    
    return () => {
      // Clear timer and cleanup
      clearTimeout(timer);
      isMounted.current = false;
      
      if (provider.cleanup) {
        provider.cleanup();
      }
    };
  }, [syncHealthData, userId]);

  // Add a safety timeout to prevent infinite loading
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        if (isMounted.current && loading) {
          console.warn('[useHealthData] Safety timeout triggered - forcing loading state to false');
          setLoading(false);
          setIsInitialized(true);
          
          if (!error) {
            setError(new Error('Health initialization timed out'));
          }
          
          isSyncInProgress.current = false;
        }
      }, 5000); // Force loading to end after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [loading, error]);

  return { loading, error, syncHealthData, isInitialized };
};
