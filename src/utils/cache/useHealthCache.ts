import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useRef } from 'react';
import type { HealthMetrics } from '../../providers/health/types/metrics';

const CACHE_PREFIX = '@health_cache:';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

interface CachedData<T> {
  data: T;
  timestamp: number;
}

export interface HealthCacheOptions {
  ttl?: number; // Time to live in milliseconds
  forceRefresh?: boolean;
}

interface PendingOperation {
  abort: () => void;
}

export const useHealthCache = () => {
  const pendingOperations = useRef<Set<PendingOperation>>(new Set());
  
  const getCacheKey = useCallback((userId: string, date: string) => 
    `${CACHE_PREFIX}${userId}:${date}`, []);
  
  const setCache = useCallback(async (
    userId: string,
    date: string,
    data: HealthMetrics
  ): Promise<void> => {
    const abortController = new AbortController();
    const operation: PendingOperation = {
      abort: () => abortController.abort()
    };
    pendingOperations.current.add(operation);

    const cacheKey = getCacheKey(userId, date);
    const cacheData: CachedData<HealthMetrics> = {
      data,
      timestamp: Date.now(),
    };

    try {
      if (!abortController.signal.aborted) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error('Error setting health cache:', error);
      }
    } finally {
      pendingOperations.current.delete(operation);
    }
  }, [getCacheKey]);

  const getCache = useCallback(async (
    userId: string,
    date: string,
    options: HealthCacheOptions = {}
  ): Promise<HealthMetrics | null> => {
    const abortController = new AbortController();
    const operation: PendingOperation = {
      abort: () => abortController.abort()
    };
    pendingOperations.current.add(operation);

    const { ttl = DEFAULT_TTL, forceRefresh = false } = options;
    
    if (forceRefresh) {
      pendingOperations.current.delete(operation);
      return null;
    }

    const cacheKey = getCacheKey(userId, date);

    try {
      if (abortController.signal.aborted) {
        return null;
      }

      const cachedString = await AsyncStorage.getItem(cacheKey);      
      if (!cachedString) {
        return null;
      }

      if (abortController.signal.aborted) {
        return null;
      }

      const cached: CachedData<HealthMetrics> = JSON.parse(cachedString);
      const now = Date.now();
      const isExpired = now - cached.timestamp > ttl;

      if (isExpired) {
        if (!abortController.signal.aborted) {
          await AsyncStorage.removeItem(cacheKey);
        }
        return null;
      }

      return cached.data;
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error('Error getting health cache:', error);
      }
      return null;
    } finally {
      pendingOperations.current.delete(operation);
    }
  }, [getCacheKey]);

  const clearCache = useCallback(async (userId: string, date?: string): Promise<void> => {
    try {
      if (date) {
        // Clear specific date
        const cacheKey = getCacheKey(userId, date);
        await AsyncStorage.removeItem(cacheKey);
      } else {
        // Clear all cached data for user
        const keys = await AsyncStorage.getAllKeys();
        const userCacheKeys = keys.filter(key => 
          key.startsWith(`${CACHE_PREFIX}${userId}:`));
        await AsyncStorage.multiRemove(userCacheKeys);
      }
    } catch (error) {
      console.error('Error clearing health cache:', error);
    }
  }, [getCacheKey]);

  // Cleanup function to abort any pending operations
  const cleanup = useCallback(() => {
    pendingOperations.current.forEach(operation => {
      operation.abort();
    });
    pendingOperations.current.clear();
  }, []);

  return {
    setCache,
    getCache,
    clearCache,
    cleanup,
  };
};