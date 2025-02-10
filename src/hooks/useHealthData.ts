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

  const syncHealthData = useCallback(async () => {
    if (!isMounted.current) return;
    
    setLoading(true);
    setError(null);

    try {
      // Initialize provider first
      try {
        await provider.initialize();
      } catch (err) {
        const originalMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[useHealthData] Health initialization error:', err);
        
        // More user-friendly error message
        const errorMessage = originalMessage.includes('not available')
          ? 'Health Connect is not available. Please ensure it is installed and set up on your device.'
          : 'Unable to connect to health services. Please check your device settings and try again.';
        
        setError(new Error(errorMessage));
        setLoading(false);
        return; // Exit early on initialization failure
      }

      // Initialize permissions
      await provider.initializePermissions(userId);

      // Only proceed with permission checks if initialization succeeded
      try {
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
      } catch (permError) {
        console.error('[useHealthData] Permission error:', permError);
        const isPermissionDenied = permError instanceof Error &&
          (permError.message.includes('permission') || permError.message.includes('denied'));
        
        throw new Error(
          isPermissionDenied
            ? 'Unable to access health data. Please check your permissions in device settings.'
            : 'There was a problem accessing health services. Please try again.'
        );
      }

      console.log('[useHealthData] Permissions granted, fetching health data...');
      // Get health data and update scores
      const healthData = await provider.getMetrics();
      
      // Only update specific health metrics
      const healthMetrics: MetricType[] = [
        'steps',
        'distance',
        'calories',
        'heart_rate',
        'basal_calories',
        'flights_climbed',
        'exercise'
      ];
      
      // Update each health metric that has a value
      let failedMetrics: string[] = [];
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

    } catch (err) {
      let errorMessage: string;
      
      // Handle specific error types with user-friendly messages
      if (err instanceof Error) {
        if (err.name === 'MetricsAuthError') {
          errorMessage = 'Your session has expired. Please sign in again.';
        } else if (err.message.includes('permission')) {
          errorMessage = 'Unable to access health data. Please check your permissions in device settings.';
        } else if (err.message.includes('network') || err.message.includes('timeout')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          // Use the error message if it's user-friendly, otherwise use a generic message
          errorMessage = err.message.includes('health') ? err.message :
            'Unable to sync health data. Please try again later.';
        }
      } else {
        errorMessage = 'An unexpected error occurred. Please try again.';
      }
      
      setError(new Error(errorMessage));
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

  return { loading, error, syncHealthData, isInitialized };
};
