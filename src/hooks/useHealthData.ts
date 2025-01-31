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
    try {
      setLoading(true);
      setError(null);

      // Initialize permissions first
      await provider.initializePermissions(userId);

      // Check permissions
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
          await metricsService.updateMetric(userId, metric, value);
        }
      });

      await Promise.all(updates);

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sync health data'));
      console.error('Health sync error:', err);
    } finally {
      setLoading(false);
    }
  }, [provider, userId]);

  // Sync on mount and cleanup on unmount
  useEffect(() => {
    syncHealthData();
    
    return () => {
      provider.cleanup();
    };
  }, [syncHealthData]);

  return { loading, error, syncHealthData };
};
