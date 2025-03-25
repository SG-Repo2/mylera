import { useState, useCallback, useEffect, useRef, useReducer, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import type { HealthProvider } from '../providers/health/types/provider';
import { metricsService } from '../services/metricsService';
import type { MetricType } from '../types/schemas';
import { isValidMetricValue } from '../utils/healthMetricUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';
import { logger, LogCategory } from '../utils/logger';

/**
 * Creates a debounced sync function that waits for a specified delay before executing
 * @param syncFn The sync function to debounce
 * @returns A debounced version of the sync function
 */
const createDebouncedSync = (syncFn: (force?: boolean) => Promise<boolean | any>) =>
  debounce(async (force = false) => {
    const result = await syncFn(force);
    return typeof result === 'boolean' ? result : false;
  }, 3000);

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
    return error.message.includes('health')
      ? error.message
      : 'Unable to sync health data. Please try again later.';
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
  | { type: 'SYNC_ERROR'; error: Error }
  | { type: 'INITIALIZE' }
  | { type: 'RESET_ERROR' };

const initialState: HealthDataState = {
  loading: true,
  error: null,
  isInitialized: false,
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

// Add offline storage keys
const STORAGE_KEYS = {
  PENDING_METRICS: 'pending_health_metrics',
  LAST_SYNC_TIME: 'last_health_sync_time',
  METRICS_CACHE: 'health_metrics_cache',
};

// Add cache configuration
const CACHE_CONFIG = {
  TTL: 5 * 60 * 1000, // 5 minutes
  MAX_SIZE: 100, // Maximum number of cached metrics
};

// Add offline storage helper functions
const savePendingMetrics = async (metrics: any) => {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_METRICS);
    const pending = existing ? JSON.parse(existing) : [];
    pending.push(metrics);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_METRICS, JSON.stringify(pending));
  } catch (error) {
    console.error('[useHealthData] Error saving pending metrics:', error);
  }
};

const processPendingMetrics = async (syncHealthData: () => Promise<boolean>) => {
  try {
    const pending = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_METRICS);
    if (pending) {
      const metrics = JSON.parse(pending);
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_METRICS);
      for (const metric of metrics) {
        await syncHealthData();
      }
    }
  } catch (error) {
    console.error('[useHealthData] Error processing pending metrics:', error);
  }
};

// Add cache helper functions
const getCachedMetrics = async () => {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.METRICS_CACHE);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_CONFIG.TTL) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error('[useHealthData] Error getting cached metrics:', error);
    return null;
  }
};

const setCachedMetrics = async (metrics: any) => {
  try {
    const cache = {
      data: metrics,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEYS.METRICS_CACHE, JSON.stringify(cache));
  } catch (error) {
    console.error('[useHealthData] Error setting cached metrics:', error);
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
export const useHealthSync = (provider: HealthProvider, userId: string) => {
  // Add early validation of userId
  if (!userId || userId.trim() === '') {
    logger.error(LogCategory.Health, '[useHealthSync] Invalid userId provided to useHealthSync');
    return {
      loading: false,
      error: new Error('Invalid user ID provided'),
      syncHealthData: async () => false,
      isInitialized: false,
    };
  }

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
    failuresCount: 0,
  });

  // Backoff tracking
  const currentBackoffMs = useRef(INITIAL_BACKOFF_MS);
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add a ref to track active sync
  const activeSyncRef = useRef<{
    promise: Promise<boolean> | null;
    timestamp: number;
  }>({ promise: null, timestamp: 0 });

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
    currentBackoffMs.current = Math.min(currentBackoffMs.current * BACKOFF_FACTOR, MAX_BACKOFF_MS);
    return currentBackoffMs.current;
  };

  const syncHealthData = useCallback(
    async (force = false) => {
      // Add early return if no userId or invalid userId
      if (!userId || userId.trim() === '') {
        logger.warn(LogCategory.Health, '[useHealthSync] No valid userId provided, skipping sync');
        dispatch({ type: 'SYNC_SUCCESS' });
        return false;
      }

      // Check if there's a recent sync in progress and return the cached promise if so
      if (
        activeSyncRef.current.promise &&
        Date.now() - activeSyncRef.current.timestamp < MIN_SYNC_INTERVAL
      ) {
        logger.debug(
          LogCategory.Health,
          '[useHealthSync] Recent sync in progress, returning cached promise'
        );
        return activeSyncRef.current.promise;
      }

      // Prevent concurrent syncs and handle unmounting
      if (!isMounted.current || isSyncInProgress.current) {
        logger.debug(
          LogCategory.Health,
          '[useHealthSync] Sync skipped - not mounted or sync in progress'
        );
        return false;
      }

      // Set up the promise at the beginning
      activeSyncRef.current = {
        promise: null,
        timestamp: Date.now(),
      };

      const syncPromise = (async () => {
        try {
          isSyncInProgress.current = true;
          dispatch({ type: 'START_SYNC' });

          // Initialize provider with the correct user ID
          if (!provider.initialize) {
            await provider.initializeWithPermissions(userId);
          }

          // Check permissions
          const permissionState = await provider.checkPermissionsStatus();
          if (permissionState.status !== 'granted') {
            const granted = await provider.requestPermissions();
            if (granted !== 'granted') {
              throw new Error('Health permissions not granted');
            }
          }

          // Fetch metrics with force flag
          const healthData = await provider.getMetrics();

          // Only update state if component is still mounted
          if (isMounted.current) {
            dispatch({ type: 'SYNC_SUCCESS' });
            resetBackoff();
            syncAttempts.current = 0;

            // Cache successful fetch
            await setCachedMetrics(healthData);
            return true;
          }

          return false;
        } catch (error) {
          if (!isMounted.current) return false;

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(LogCategory.Health, '[useHealthSync] Sync error:', errorMessage);

          // Handle specific error cases
          if (
            errorMessage.includes('must be initialized') ||
            errorMessage.includes('user ID is not valid')
          ) {
            dispatch({
              type: 'SYNC_ERROR',
              error: new Error('Health sync unavailable: no valid user ID'),
            });
          } else {
            dispatch({
              type: 'SYNC_ERROR',
              error: error instanceof Error ? error : new Error('Sync failed'),
            });
          }
          return false;
        } finally {
          if (isMounted.current) {
            isSyncInProgress.current = false;
          }
        }
      })();

      // Store the promise for future reference
      activeSyncRef.current.promise = syncPromise;
      return syncPromise;
    },
    [provider, userId]
  );

  // Memoize the debounced sync function
  const debouncedSync = useMemo(() => createDebouncedSync(syncHealthData), [syncHealthData]);

  // Combined effect for network and app state monitoring
  useEffect(() => {
    let networkSubscription: any = null;

    // Network change handler
    const handleNetworkChange = async (state: NetInfoState) => {
      if (state.isConnected && isMounted.current && !isSyncInProgress.current && userId?.trim()) {
        logger.info(
          LogCategory.Health,
          '[useHealthSync] Network connection restored, processing pending metrics'
        );
        await processPendingMetrics(async () => {
          const result = await syncHealthData();
          return Boolean(result);
        });
      }
    };

    // App state change handler
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        nextAppState === 'active' &&
        isMounted.current &&
        !isSyncInProgress.current &&
        userId?.trim()
      ) {
        const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
        if (timeSinceLastSync > MIN_SYNC_INTERVAL * 2) {
          logger.info(
            LogCategory.Health,
            '[useHealthSync] App returned to foreground, triggering sync'
          );
          syncHealthData();
        }
      }
    };

    // Set up listeners
    const setupListeners = async () => {
      try {
        networkSubscription = NetInfo.addEventListener(handleNetworkChange);
        const appSubscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
          if (networkSubscription) networkSubscription();
          appSubscription.remove();
        };
      } catch (error) {
        logger.warn(
          LogCategory.Health,
          '[useHealthSync] Error setting up listeners:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    };

    // Setup listeners and handle async cleanup properly
    let cleanupFn: (() => void) | undefined;

    setupListeners()
      .then(result => {
        if (result && typeof result === 'function') {
          cleanupFn = result;
        }
      })
      .catch(err => {
        logger.warn(
          LogCategory.Health,
          '[useHealthSync] Error in listener setup:',
          err instanceof Error ? err.message : 'Unknown error'
        );
      });

    // Return a synchronous cleanup function
    return () => {
      if (cleanupFn && typeof cleanupFn === 'function') {
        cleanupFn();
      }

      // Ensure we clean up even if the async setup hasn't completed
      if (networkSubscription) {
        networkSubscription();
      }
    };
  }, [syncHealthData, userId]);

  // Sync on mount and cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    isSyncInProgress.current = false;

    if (!userId || userId.trim() === '') {
      logger.warn(LogCategory.Health, '[useHealthSync] No valid userId available - skipping sync');
      dispatch({ type: 'SYNC_SUCCESS' }); // Set loading to false and mark as initialized
      return;
    }

    // Use a timeout to give the UI a chance to render first
    const timer = setTimeout(() => {
      if (isMounted.current) {
        syncHealthData();
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      clearBackoffTimer();
      isMounted.current = false;

      if (provider.cleanup) {
        provider.cleanup();
      }
    };
  }, [syncHealthData, userId]);

  // Modify the safety timeout effect
  useEffect(() => {
    if (loading) {
      const SAFETY_TIMEOUT = 15000; // Reduce to 15 seconds
      const timer = setTimeout(() => {
        if (isMounted.current && loading) {
          logger.warn(
            LogCategory.Health,
            '[useHealthSync] Health data sync taking longer than expected'
          );

          // Force sync to complete if stuck
          dispatch({ type: 'SYNC_SUCCESS' });
          isSyncInProgress.current = false;
        }
      }, SAFETY_TIMEOUT);

      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Add cleanup prevention during active sync
  useEffect(() => {
    const cleanup = () => {
      if (!isSyncInProgress.current && !activeSyncRef.current.promise) {
        provider.cleanup?.();
      }
    };

    return cleanup;
  }, [provider]);

  return {
    loading,
    error,
    syncHealthData,
    isInitialized,
  };
};
