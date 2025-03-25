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

export const useHealthSync = (provider: HealthProvider, userId: string) => {
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
    if (!userId) {
      console.log('[useHealthData] No userId provided, skipping sync');
      dispatch({ type: 'SYNC_SUCCESS' });
      return false;
    }

    if (!isMounted.current || isSyncInProgress.current) {
      console.log('[useHealthData] Sync skipped - not mounted or sync in progress');
      return false;
    }

    try {
      // Check cache first if not a forced refresh
      if (!force) {
        const cachedData = await getCachedMetrics();
        if (cachedData) {
          console.log('[useHealthData] Using cached health data');
          dispatch({ type: 'SYNC_SUCCESS' });
          return true;
        }
      }

      isSyncInProgress.current = true;
      dispatch({ type: 'START_SYNC' });

      if (!provider.initialize) {
        await provider.initializeWithPermissions(userId);
      }

      const permissionState = await provider.checkPermissionsStatus();
      if (permissionState.status !== 'granted') {
        const granted = await provider.requestPermissions();
        if (granted !== 'granted') {
          throw new Error('Health permissions not granted');
        }
      }

      const healthData = await provider.getMetrics();
      
      if (isMounted.current) {
        dispatch({ type: 'SYNC_SUCCESS' });
        resetBackoff();
        syncAttempts.current = 0;
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
    let debounceTimer: NodeJS.Timeout | null = null;
    
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isMounted.current && !isSyncInProgress.current) {
        if (debounceTimer) clearTimeout(debounceTimer);
        
        debounceTimer = setTimeout(() => {
          const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
          if (timeSinceLastSync > MIN_SYNC_INTERVAL * 2) {
            console.log('[useHealthData] App returned to foreground, triggering sync');
            syncHealthData();
          }
        }, 1000);
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
      if (debounceTimer) clearTimeout(debounceTimer);
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
