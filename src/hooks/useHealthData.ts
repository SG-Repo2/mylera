import { useState, useCallback, useEffect, useRef } from 'react';
import type { HealthProvider } from '../providers/health/types/provider';
import { metricsService } from '../services/metricsService';
import type { MetricType } from '../types/schemas';

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
  const syncAttempts = useRef(0);
  const MAX_SYNC_ATTEMPTS = 3;

  const syncHealthData = useCallback(async () => {
    if (!isMounted.current) return;
    if (!userId) {
      setError(new Error('User ID is required to sync health data'));
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    syncAttempts.current += 1;

    try {
      // Use the atomic initialization with permissions
      await provider.initializeWithPermissions(userId);
      
      // Check permission status
      const permissionState = await provider.checkPermissionsStatus();
      
      // If permissions aren't granted, request them
      if (permissionState.status !== 'granted') {
        console.log('[useHealthData] Requesting health permissions...');
        const granted = await provider.requestPermissions();
        
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
      
      // Only update specific health metrics
      const healthMetrics: MetricType[] = [
        'steps', 'distance', 'calories', 'heart_rate',
        'basal_calories', 'flights_climbed', 'exercise'
      ];
      
      // Update each health metric that has a value
      const failedMetrics: string[] = [];
      const updates = healthMetrics.map(async metric => {
        const value = healthData[metric];
        if (typeof value === 'number') {
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
        }
      });

      await Promise.all(updates);

      // If some metrics failed but not all, show a warning but don't fail completely
      if (failedMetrics.length > 0 && failedMetrics.length < healthMetrics.length) {
        console.warn(`[useHealthData] Some metrics failed to update: ${failedMetrics.join(', ')}`);
      }

      // Reset sync attempts on success
      syncAttempts.current = 0;

    } catch (err) {
      // Determine if we should retry
      const shouldRetry = syncAttempts.current < MAX_SYNC_ATTEMPTS &&
                        !(err instanceof Error && err.message.includes('permissions not granted'));
      
      let errorMessage: string;
      
      // Create user-friendly error messages
      if (err instanceof Error) {
        if (err.name === 'MetricsAuthError') {
          errorMessage = 'Your session has expired. Please sign in again.';
        } else if (err.message.includes('permission')) {
          // Show this error but still allow app to function with limited features
          errorMessage = 'Limited health data access. Some features may be unavailable.';
        } else if (err.message.includes('network') || err.message.includes('timeout')) {
          errorMessage = 'Network error. Check your connection and try again.';
        } else {
          errorMessage = err.message.includes('health') ? err.message :
            'Unable to sync health data. Please try again later.';
        }
      } else {
        errorMessage = 'An unexpected error occurred. Please try again.';
      }
      
      setError(new Error(errorMessage));
      console.error('[useHealthData] Health sync error:', err);
      
      // If we should retry, do so after a delay
      if (shouldRetry) {
        setTimeout(() => {
          if (isMounted.current) syncHealthData();
        }, 1000);
        return;
      }
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

  return { loading, error, syncHealthData, isInitialized };
};
