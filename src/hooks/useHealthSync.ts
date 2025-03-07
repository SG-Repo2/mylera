import { useState, useCallback, useEffect, useRef, useReducer } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
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

// Define state reducer for batching updates
type HealthDataState = {
  loading: boolean;
  error: Error | null;
  isInitialized: boolean;
};

type HealthDataAction = 
  | { type: 'START_SYNC' }
  | { type: 'SYNC_SUCCESS' }
  | { type: 'SYNC_ERROR', error: Error }
  | { type: 'INITIALIZE' }
  | { type: 'RESET_ERROR' };

const initialState: HealthDataState = {
  loading: true,
  error: null,
  isInitialized: false
};

function healthDataReducer(state: HealthDataState, action: HealthDataAction): HealthDataState {
  switch (action.type) {
    case 'START_SYNC':
      return { ...state, loading: true, error: null };
    case 'SYNC_SUCCESS':
      return { ...state, loading: false, error: null, isInitialized: true };
    case 'SYNC_ERROR':
      return { ...state, loading: false, error: action.error, isInitialized: true };
    case 'INITIALIZE':
      return { ...state, isInitialized: true };
    case 'RESET_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

// Constants for backoff calculations
const INITIAL_BACKOFF_MS = 1000; // Start with 1 second
const MAX_BACKOFF_MS = 30000; // Maximum backoff of 30 seconds
const BACKOFF_FACTOR = 1.5; // Exponential factor

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
export const useHealthSync = (provider: HealthProvider, userId: string) => {
  // Use reducer instead of multiple useState calls to batch updates
  const [state, dispatch] = useReducer(healthDataReducer, initialState);
  const { loading, error, isInitialized } = state;
  
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
  
  // Backoff tracking
  const currentBackoffMs = useRef(INITIAL_BACKOFF_MS);
  const backoffTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clear any existing backoff timer
  const clearBackoffTimer = () => {
    if (backoffTimerRef.current) {
      clearTimeout(backoffTimerRef.current);
      backoffTimerRef.current = null;
    }
  };
  
  // Reset backoff timer
  const resetBackoff = () => {
    clearBackoffTimer();
    currentBackoffMs.current = INITIAL_BACKOFF_MS;
  };
  
  // Calculate next backoff with exponential strategy
  const calculateNextBackoff = () => {
    currentBackoffMs.current = Math.min(
      currentBackoffMs.current * BACKOFF_FACTOR,
      MAX_BACKOFF_MS
    );
    return currentBackoffMs.current;
  };

  const syncHealthData = useCallback(async (force = false) => {
    // Set initialized immediately to ensure the UI is responsive
    if (!isInitialized) {
      dispatch({ type: 'INITIALIZE' });
    }
    
    // Prevent concurrent syncs and handle unmounting
    if (!isMounted.current || isSyncInProgress.current) {
      console.log('[useHealthData] Sync skipped - not mounted or sync in progress');
      return false; // Return false to indicate sync did not happen
    }
    
    // Check for minimum time between syncs to prevent unnecessary operations
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;
    if (!force && timeSinceLastSync < MIN_SYNC_INTERVAL && isInitialized) {
      console.log(`[useHealthData] Sync skipped - too soon (${timeSinceLastSync}ms since last sync)`);
      return false; // Return false to indicate sync did not happen
    }
    
    if (!userId) {
      dispatch({ type: 'SYNC_ERROR', error: new Error('User ID is required to sync health data') });
      return false; // Return false to indicate sync did not happen
    }
    
    isSyncInProgress.current = true;
    dispatch({ type: 'START_SYNC' });
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
        // Still mark as initialized and handle error
        dispatch({ 
          type: 'SYNC_ERROR', 
          error: initError instanceof Error ? initError : new Error('Health provider initialization failed')
        });
        isSyncInProgress.current = false;
        
        // Schedule retry with exponential backoff for network-related errors
        if (initError instanceof Error && 
            (initError.message.includes('network') || initError.message.includes('timeout')) &&
            syncAttempts.current < MAX_SYNC_ATTEMPTS) {
          const backoffTime = calculateNextBackoff();
          console.log(`[useHealthData] Scheduling retry in ${backoffTime}ms`);
          backoffTimerRef.current = setTimeout(() => {
            if (isMounted.current) {
              syncHealthData(true);
            }
          }, backoffTime);
        } else {
          // Reset backoff for non-retriable errors
          resetBackoff();
        }
        
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
          dispatch({ 
            type: 'SYNC_ERROR', 
            error: new Error('Health permissions not granted. Some features may be limited.')
          });
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
        dispatch({ 
          type: 'SYNC_ERROR',
          error: metricError instanceof Error ? metricError : new Error('Failed to fetch health metrics')
        });
        isSyncInProgress.current = false;
        
        // Schedule retry with exponential backoff for network-related errors
        if (metricError instanceof Error && 
            (metricError.message.includes('network') || metricError.message.includes('timeout')) &&
            syncAttempts.current < MAX_SYNC_ATTEMPTS) {
          const backoffTime = calculateNextBackoff();
          console.log(`[useHealthData] Scheduling retry in ${backoffTime}ms`);
          backoffTimerRef.current = setTimeout(() => {
            if (isMounted.current) {
              syncHealthData(true);
            }
          }, backoffTime);
        } else {
          // Reset backoff for non-retriable errors
          resetBackoff();
        }
        
        return;
      }
      
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
      
      // Update sync results stats
      syncResultsRef.current.lastSuccessTime = Date.now();
      syncResultsRef.current.metricUpdatesCount += successfulUpdates.length;
      syncResultsRef.current.failuresCount += failedMetrics.length;
      
      // Log sync status
      console.log(`[useHealthData] Sync complete - Updated: ${successfulUpdates.join(', ')} - Failed: ${failedMetrics.length > 0 ? failedMetrics.join(', ') : 'none'}`);
      
      // Reset error state and backoff on successful sync
      dispatch({ type: 'SYNC_SUCCESS' });
      resetBackoff();
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
        
        // Schedule retry with exponential backoff
        const backoffTime = calculateNextBackoff();
        console.log(`[useHealthData] Scheduling retry in ${backoffTime}ms`);
        backoffTimerRef.current = setTimeout(() => {
          if (isMounted.current) {
            syncHealthData(true);
          }
        }, backoffTime);
      } else {
        // Only set the error on the final attempt or for non-retryable errors
        dispatch({ 
          type: 'SYNC_ERROR', 
          error: Object.assign(originalError, { userMessage })
        });
        syncResultsRef.current.failuresCount += 1;
        // Reset backoff for non-retriable errors
        resetBackoff();
      }
    } finally {
      if (isMounted.current) {
        // For state updates in finally, we're already using the reducer
        isSyncInProgress.current = false;
      }
    }
  }, [provider, userId, isInitialized]);

  // Monitor network state to trigger resyncs when connection is restored
  useEffect(() => {
    let networkSubscription: any = null;
    
    const handleNetworkChange = (state: NetInfoState) => {
      if (state.isConnected && isMounted.current && !isSyncInProgress.current) {
        // If we're coming back online and have had failures, trigger a sync
        if (syncResultsRef.current.failuresCount > 0) {
          console.log('[useHealthData] Network connection restored, triggering sync');
          // Use a small delay to ensure the connection is stable
          setTimeout(() => syncHealthData(true), 1000);
        }
      }
    };
    
    // Subscribe to network state changes
    const setupNetworkListeners = async () => {
      try {
        networkSubscription = NetInfo.addEventListener(handleNetworkChange);
      } catch (error) {
        console.warn('[useHealthData] Error setting up network listeners:', error);
      }
    };
    
    setupNetworkListeners();
    
    // Clean up subscription on unmount
    return () => {
      if (networkSubscription) {
        networkSubscription();
      }
    };
  }, [syncHealthData]);
  
  // Monitor app state to trigger resyncs when app returns to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isMounted.current && !isSyncInProgress.current) {
        // Check if it's been long enough since last sync before triggering a new one
        const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
        if (timeSinceLastSync > MIN_SYNC_INTERVAL * 2) {
          console.log('[useHealthData] App returned to foreground, triggering sync');
          syncHealthData();
        }
      }
    };
    
    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Clean up subscription on unmount
    return () => {
      subscription.remove();
    };
  }, [syncHealthData]);

  // Sync on mount and cleanup on unmount
  useEffect(() => {
    // Always set these flags immediately
    isMounted.current = true;
    isSyncInProgress.current = false;
    
    // Set initialized immediately so UI can render
    dispatch({ type: 'INITIALIZE' });
    
    if (!userId) {
      console.warn('useHealthData: No userId available - skipping sync');
      dispatch({ type: 'SYNC_SUCCESS' }); // Just set loading to false
      return;
    }
    
    // Use a timeout to give the UI a chance to render first
    const timer = setTimeout(() => {
      if (isMounted.current) {
        syncHealthData();
      }
    }, 100);
    
    return () => {
      // Clear all timers and cleanup
      clearTimeout(timer);
      clearBackoffTimer();
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
          
          dispatch({ 
            type: 'SYNC_ERROR', 
            error: error || new Error('Health initialization timed out')
          });
          
          isSyncInProgress.current = false;
        }
      }, 5000); // Force loading to end after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [loading, error]);

  return { loading, error, syncHealthData, isInitialized };
};
