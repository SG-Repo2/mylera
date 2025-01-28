import { useState, useCallback, useEffect, useRef } from 'react';
import { useHealthCache } from '../utils/cache/useHealthCache';
import type { HealthMetrics } from '../providers/health/types/metrics';
import type { HealthProvider } from '../providers/health/types/provider';
import { HealthDataError } from '../providers/health/types/errors';

interface UseHealthDataOptions {
  ttl?: number;
  autoSync?: boolean;
}

interface UseHealthDataResult {
  metrics: HealthMetrics | null;
  loading: boolean;
  error: Error | null;
  syncHealthData: (forceRefresh?: boolean) => Promise<void>;
}

export const useHealthData = (
  provider: HealthProvider,
  userId: string,
  date: string,
  options: UseHealthDataOptions = {}
): UseHealthDataResult => {
  const { ttl, autoSync = true } = options;
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const syncInProgress = useRef(false);
  
  const { getCache, setCache, cleanup: cleanupCache } = useHealthCache();

  const initializeProvider = useCallback(async () => {
    if (!isInitialized) {
      await provider.initialize();
      setIsInitialized(true);
    }
  }, [provider, isInitialized]);

  const syncHealthData = useCallback(async (forceRefresh: boolean = false) => {
    // Prevent multiple simultaneous syncs
    if (syncInProgress.current) {
      return;
    }
    syncInProgress.current = true;

    setLoading(true);
    setError(null);

    try {
      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedData = await getCache(userId, date, { ttl });
        if (cachedData) {
          setMetrics(cachedData);
          syncInProgress.current = false;
          setLoading(false);
          return;
        }
      }

      // Initialize provider if needed
      await initializeProvider();

      // Check permissions
      const hasPermissions = await provider.checkPermissionsStatus();
      if (!hasPermissions) {
        const granted = await provider.requestPermissions();
        if (!granted) {
          throw new HealthDataError('health_permissions_denied', 
            'Health data access permissions were denied');
        }
      }

      // Fetch fresh data
      const freshMetrics = await provider.getMetrics();
      
      // Cache the fresh data
      await setCache(userId, date, freshMetrics);
      
      setMetrics(freshMetrics);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      setError(error);
      console.error('Error syncing health data:', error);
    } finally {
      setLoading(false);
      syncInProgress.current = false;
    }
  }, [provider, userId, date, ttl, getCache, setCache, initializeProvider]);

  // Initial sync on mount if autoSync is enabled
  useEffect(() => {
    if (autoSync) {
      syncHealthData();
    }
  }, [autoSync, syncHealthData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupCache();
      
      if (isInitialized) {
        provider.cleanup().catch(console.error);
      }
      syncInProgress.current = false;
    };
  }, [provider, isInitialized, cleanupCache]);

  return {
    metrics,
    loading,
    error,
    syncHealthData
  };
};