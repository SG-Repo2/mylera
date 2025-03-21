import { useState, useCallback, useEffect, useRef, useReducer, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import type { HealthProvider } from '../providers/health/types/provider';
import { metricsService } from '../services/metricsService';
import type { MetricType } from '../types/schemas';
import { isValidMetricValue } from '../utils/healthMetricUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';

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

// Add offline storage keys
const STORAGE_KEYS = {
  PENDING_METRICS: 'pending_health_metrics',
  LAST_SYNC_TIME: 'last_health_sync_time',
  METRICS_CACHE: 'health_metrics_cache'
};

// Add cache configuration
const CACHE_CONFIG = {
  TTL: 5 * 60 * 1000, // 5 minutes
  MAX_SIZE: 100 // Maximum number of cached metrics
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
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(STORAGE_KEYS.METRICS_CACHE, JSON.stringify(cache));
  } catch (error) {
    console.error('[useHealthData] Error setting cached metrics:', error);
  }
};

// Add health score calculation constants
const HEALTH_SCORE_WEIGHTS = {
  steps: 0.2,
  distance: 0.2,
  calories: 0.15,
  heart_rate: 0.15,
  basal_calories: 0.15,
  flights_climbed: 0.1,
  exercise: 0.05
};

// Add memoized health score calculation
const calculateHealthScore = (metrics: any): number => {
  let totalScore = 0;
  let totalWeight = 0;

  Object.entries(HEALTH_SCORE_WEIGHTS).forEach(([metric, weight]) => {
    const value = metrics[metric];
    if (typeof value === 'number' && isValidMetricValue(value, metric as MetricType)) {
      const goal = getMetricGoal(metric as MetricType);
      const score = Math.min((value / goal) * 100, 100);
      totalScore += score * weight;
      totalWeight += weight;
    }
  });

  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
};

// Add metric goal helper
const getMetricGoal = (metricType: MetricType): number => {
  const goals: Record<MetricType, number> = {
    steps: 10000,
    distance: 5000,
    calories: 500,
    heart_rate: 100,
    basal_calories: 1800,
    flights_climbed: 10,
    exercise: 30
  };
  return goals[metricType] || 0;
};

// Add metric points calculation
const calculateMetricPoints = (value: number, metricType: MetricType): number => {
  const goal = getMetricGoal(metricType);
  if (value >= goal) return 100;
  return Math.round((value / goal) * 100);
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
  // Use reducer instead of multiple useState calls to batch updates
  const [state, dispatch] = useReducer(healthDataReducer, initialState);
  const { loading, error, isInitialized } = state;
  
  // Add state for health data
  const [healthData, setHealthData] = useState<Record<string, number>>({});
  const [metricState, setMetricState] = useState<Record<string, any>>({});
  const [healthScore, setHealthScore] = useState(0);
  
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
    currentBackoffMs.current = Math.min(
      currentBackoffMs.current * BACKOFF_FACTOR,
      MAX_BACKOFF_MS
    );
    return currentBackoffMs.current;
  };

  const syncHealthData = useCallback(async (force = false) => {
    // Add early return if no userId
    if (!userId) {
      console.log('[useHealthData] No userId provided, skipping sync');
      dispatch({ type: 'SYNC_SUCCESS' });
      return false;
    }

    // Prevent concurrent syncs and handle unmounting
    if (!isMounted.current || isSyncInProgress.current) {
      console.log('[useHealthData] Sync skipped - not mounted or sync in progress');
      return false;
    }

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
      
      console.error('[useHealthData] Sync error:', error);
      dispatch({ 
        type: 'SYNC_ERROR',
        error: error instanceof Error ? error : new Error('Sync failed')
      });
      return false;
    } finally {
      if (isMounted.current) {
        isSyncInProgress.current = false;
      }
    }
  }, [provider, userId]);

  // Add debounced sync function after syncHealthData declaration
  const debouncedSync = useCallback(
    debounce(async (force = false) => {
      await syncHealthData(force);
    }, 3000),
    [syncHealthData]
  );

  // Monitor network state to trigger resyncs when connection is restored
  useEffect(() => {
    let networkSubscription: any = null;
    
    const handleNetworkChange = async (state: NetInfoState) => {
      if (state.isConnected && isMounted.current && !isSyncInProgress.current) {
        console.log('[useHealthData] Network connection restored, processing pending metrics');

        await processPendingMetrics(async () => {
          const result = await syncHealthData();
          return Boolean(result);
        });
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
    isMounted.current = true;
    isSyncInProgress.current = false;
    
    if (!userId) {
      console.warn('useHealthData: No userId available - skipping sync');
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
          console.warn('[useHealthData] Health data sync taking longer than expected');
          
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
    isInitialized
  };
};
