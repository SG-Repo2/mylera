import { useState, useCallback, useEffect } from 'react';
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

  const syncHealthData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Initialize provider first
      try {
        await provider.initialize();
      } catch (err) {
        const originalMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Health initialization error:', err);
        setError(new Error(`Failed to initialize health provider: ${originalMessage}`));
        setLoading(false);
        return; // Exit early on initialization failure
      }

      // Initialize permissions
      await provider.initializePermissions(userId);

      // Only proceed with permission checks if initialization succeeded
      const permissionState = await provider.checkPermissionsStatus();
      if (permissionState.status !== 'granted') {
        const granted = await provider.requestPermissions();
        if (granted !== 'granted') {
          throw new Error('Health permissions denied');
        }
      }

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
            // For other errors, log but continue processing other metrics
            console.error(`Error updating metric ${metric}:`, err);
          }
        }
      });

      await Promise.all(updates);

    } catch (err) {
      let errorMessage = 'Failed to sync health data';
      
      // Handle specific error types
      if (err instanceof Error) {
        if (err.name === 'MetricsAuthError') {
          errorMessage = `Authentication error: ${err.message}`;
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(new Error(errorMessage));
      console.error('Health sync error:', err);
    } finally {
      setLoading(false);
    }
  }, [provider, userId]);

  // Sync on mount and cleanup on unmount
  useEffect(() => {
    if (!userId) {
      console.warn('useHealthData: No userId available - skipping sync');
      setLoading(false);
      return;
    }
    
    syncHealthData();
    
    return () => {
      if (provider.cleanup) {
        provider.cleanup();
      }
    };
  }, [syncHealthData, userId]);

  return { loading, error, syncHealthData };
};
