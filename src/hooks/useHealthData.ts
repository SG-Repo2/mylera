import { useState, useCallback, useEffect } from 'react';
import type { HealthProvider } from '../providers/health/types/provider';
import { metricsService } from '../services/metricsService';
import type { MetricType } from '../types/schemas';

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
      const hasPermissions = await provider.checkPermissionsStatus();
      if (!hasPermissions) {
        const granted = await provider.requestPermissions();
        if (!granted) {
          throw new Error('Health permissions denied');
        }
      }

      // Get health data and update scores
      const healthData = await provider.getMetrics();
      
      // Update each metric that has a value
      const updates = Object.entries(healthData).map(async ([metric, value]) => {
        if (typeof value === 'number') {
          await metricsService.updateMetric(userId, metric as MetricType, value);
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
