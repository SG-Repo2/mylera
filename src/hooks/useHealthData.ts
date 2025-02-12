import { useState, useCallback, useEffect, useRef } from 'react';
import type { HealthProvider } from '../providers/health/types/provider';
import { metricsService } from '../services/metricsService';
import type { MetricType } from '../types/schemas';
import { BatchUpdateManager, type MetricUpdate } from '../utils/batchUtils';

// Health metrics that we track
const HEALTH_METRICS: MetricType[] = [
  'steps',
  'distance',
  'calories',
  'heart_rate',
  'basal_calories',
  'flights_climbed',
  'exercise'
];

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

interface SyncState {
  status: SyncStatus;
  lastSyncTime: Date | null;
  lastError: Error | null;
  metrics: Record<MetricType, number | null>;
}

const initialSyncState: SyncState = {
  status: 'idle',
  lastSyncTime: null,
  lastError: null,
  metrics: HEALTH_METRICS.reduce((acc, metric) => ({
    ...acc,
    [metric]: null
  }), {} as Record<MetricType, number | null>)
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
  const [syncState, setSyncState] = useState<SyncState>(initialSyncState);
  const [isInitialized, setIsInitialized] = useState(false);
  const isMounted = useRef(true);
  const batchManager = useRef<BatchUpdateManager | null>(null);

  // Initialize batch manager
  useEffect(() => {
    if (!batchManager.current) {
      batchManager.current = new BatchUpdateManager(
        async (updates: MetricUpdate[]) => {
          try {
            await metricsService.updateMetricsBatch(updates);
            
            if (isMounted.current) {
              setSyncState(prev => ({
                ...prev,
                status: 'success',
                lastSyncTime: new Date()
              }));
            }
          } catch (error) {
            console.error('[useHealthData] Batch update error:', error);
            
            // Handle specific error types
            let errorMessage = 'Failed to update metrics';

            if (error instanceof Error) {
              if (error.message.includes('PGRST202') || 
                  error.message.includes('Invalid or expired session') ||
                  error.message.includes('JWT')) {
                errorMessage = 'Your session has expired. Please sign out and sign in again to refresh your credentials.';
                // Clear sync state to trigger re-auth
                if (isMounted.current) {
                  setSyncState(prev => ({
                    ...prev,
                    status: 'error',
                    lastError: new Error(errorMessage)
                  }));
                }
                // Don't throw - this will prevent retries for auth errors
                return;
              }
            }

            if (isMounted.current) {
              setSyncState(prev => ({
                ...prev,
                status: 'error',
                lastError: new Error(errorMessage)
              }));
            }
            
            // Re-throw non-auth errors to trigger retry logic
            throw error;
          }
        },
        { 
          debounceMs: 1000,
          maxBatchSize: 50,
          retryOptions: {
            maxRetries: 3,
            baseDelayMs: 1000,
            maxDelayMs: 10000
          }
        }
      );
    }

    return () => {
      if (batchManager.current) {
        batchManager.current.clearBatch();
        batchManager.current = null;
      }
    };
  }, []);

  const syncHealthData = useCallback(async () => {
    if (!isMounted.current || !userId) return;
    
    setLoading(true);
    setSyncState(prev => ({ ...prev, status: 'syncing', lastError: null }));

    try {
      // Initialize permission manager with retries
      const MAX_INIT_RETRIES = 3;
      const RETRY_DELAY = 1000; // 1 second

      let initSuccess = false;
      for (let i = 0; i < MAX_INIT_RETRIES && !initSuccess; i++) {
        try {
          await provider.initializePermissions(userId);
          initSuccess = true;
        } catch (err) {
          console.warn(`[useHealthData] Permission manager initialization attempt ${i + 1}/${MAX_INIT_RETRIES} failed:`, err);
          if (i < MAX_INIT_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        }
      }

      if (!initSuccess) {
        throw new Error('Failed to initialize permission manager after multiple attempts');
      }

      // Initialize provider
      try {
        await provider.initialize();
      } catch (err) {
        const originalMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[useHealthData] Health initialization error:', err);
        
        const errorMessage = originalMessage.includes('not available')
          ? 'Health Connect is not available. Please ensure it is installed and set up on your device.'
          : 'Unable to connect to health services. Please check your device settings and try again.';
        
        throw new Error(errorMessage);
      }

      // Check and request permissions
      const permissionState = await provider.checkPermissionsStatus();
      
      if (permissionState.status !== 'granted') {
        console.log('[useHealthData] Requesting health permissions...');
        const granted = await provider.requestPermissions();
        if (granted !== 'granted') {
          throw new Error(
            'Health permissions are required to track your fitness metrics. ' +
            'Please grant permissions in your device settings.'
          );
        }
      }

      console.log('[useHealthData] Permissions granted, fetching health data...');
      const healthData = await provider.getMetrics();
      
      // Update sync state with fetched metrics
      if (isMounted.current) {
        setSyncState(prev => ({
          ...prev,
          metrics: HEALTH_METRICS.reduce((acc, metric) => ({
            ...acc,
            [metric]: healthData[metric] ?? null
          }), {} as Record<MetricType, number | null>)
        }));
      }
      
      // Queue updates for each metric that has a value
      const timestamp = new Date().toISOString();
      HEALTH_METRICS.forEach(metric => {
        const value = healthData[metric];
        if (typeof value === 'number' && batchManager.current) {
          batchManager.current.queueUpdate({
            userId,
            metricType: metric,
            value,
            timestamp
          });
        }
      });

    } catch (err) {
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
      
      const error = new Error(errorMessage);
      if (isMounted.current) {
        setSyncState(prev => ({
          ...prev,
          status: 'error',
          lastError: error
        }));
      }
      console.error('[useHealthData] Health sync error:', err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsInitialized(true);
      }
    }
  }, [provider, userId]);

  // Sync on mount and cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    
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

  return {
    loading,
    isInitialized,
    syncHealthData,
    syncState
  };
};
