/**
 * Enhanced useHealthData Hook
 * 
 * A custom hook for fetching and managing health data with proper cancellation
 * support and resource cleanup to prevent memory leaks and race conditions.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { debounce } from 'lodash';
import type { HealthProvider } from '../providers/health/types/provider';
import type { HealthMetrics } from '../providers/health/types/metrics';
import { logger, LogCategory } from '../utils/logger';
import { unifiedMetricsService } from '../services/unifiedMetricsService';
import { useAuth } from '../providers/AuthProvider';
import { callWithTimeout, DEFAULT_TIMEOUTS } from '../utils/asyncUtils';

/**
 * Interface for useHealthData hook return value
 */
interface UseHealthDataResult {
  /** The current health metrics data */
  data: HealthMetrics | null;
  /** Whether data is currently being loaded */
  loading: boolean;
  /** Any error that occurred during data loading */
  error: Error | null;
  /** Function to manually trigger data synchronization */
  syncHealthData: () => void;
  /** Whether the provider is fully initialized */
  isInitialized: boolean;
}

/**
 * Custom hook for managing health data synchronization.
 * 
 * This hook handles initialization, permission management, data fetching, and cleanup
 * with proper AbortController integration for cancellation support.
 * 
 * @param provider Platform-specific health provider instance
 * @param userId Unique identifier of the user
 * @returns Object containing data, loading state, error, and functions to control data sync
 */
export const useHealthData = (
  provider: HealthProvider, 
  userId: string
): UseHealthDataResult => {
  // State
  const [data, setData] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Context from AuthProvider
  const { healthInitState } = useAuth();
  
  // Refs to track request state
  const isMounted = useRef<boolean>(true);
  const syncInProgress = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const syncRequestId = useRef<number>(0);
  
  /**
   * Helper function to create a descriptive error message
   */
  const createErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return 'Data fetch was cancelled';
      } else if (err.name === 'TimeoutError') {
        return 'Data fetch timed out. Please try again.';
      } else if (err.message.includes('permission')) {
        return 'Unable to access health data. Please check your permissions in device settings.';
      } else if (err.message.includes('network') || err.message.includes('timeout')) {
        return 'Network error. Please check your connection and try again.';
      } else {
        return err.message;
      }
    }
    return 'An unexpected error occurred. Please try again later.';
  };
  
  /**
   * Helper function to handle sync errors consistently
   */
  const handleSyncError = useCallback((err: unknown, requestId: number) => {
    // Ignore if component unmounted or request was superseded
    if (!isMounted.current || requestId !== syncRequestId.current) {
      logger.debug(
        LogCategory.Health,
        `Ignoring error from stale request`,
        `sync-${requestId}`,
        userId,
        { error: err }
      );
      return;
    }
    
    // Handle abort errors silently
    if (err instanceof Error && err.name === 'AbortError') {
      logger.debug(
        LogCategory.Health,
        `Sync request aborted`,
        `sync-${requestId}`,
        userId
      );
      return;
    }
    
    // Log error details
    logger.error(
      LogCategory.Health,
      `Health data sync error`,
      `sync-${requestId}`,
      userId,
      { error: err }
    );
    
    // Update error state with user-friendly message
    const errorMessage = createErrorMessage(err);
    setError(new Error(errorMessage));
    
    // Reset loading state
    setLoading(false);
    syncInProgress.current = false;
  }, [userId]);
  
  /**
   * Debounced sync function to prevent rapid consecutive syncs
   */
  const debouncedSync = useCallback(
    debounce(async (requestId: number) => {
      // Skip if unmounted, sync in progress, or provider not initialized
      if (!isMounted.current || syncInProgress.current || !healthInitState.isInitialized) {
        logger.debug(
          LogCategory.Health,
          `Skipping sync: ${!isMounted.current ? 'unmounted' : 
                          syncInProgress.current ? 'in progress' : 
                          'provider not initialized'}`,
          `sync-${requestId}`,
          userId
        );
        return;
      }
      
      syncInProgress.current = true;
      setLoading(true);
      
      // Clear previous error
      if (error) setError(null);
      
      logger.info(
        LogCategory.Health,
        `Starting health data sync`,
        `sync-${requestId}`,
        userId
      );
      
      try {
        // Create new AbortController for this sync
        if (abortControllerRef.current) {
          logger.debug(
            LogCategory.Health,
            `Aborting previous sync`,
            `sync-${requestId}`,
            userId
          );
          abortControllerRef.current.abort();
        }
        
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        
        // Fetch data with timeout
        const metrics = await callWithTimeout(
          unifiedMetricsService.getMetrics(userId, undefined, provider),
          DEFAULT_TIMEOUTS.API_CALL,
          `Health metrics fetch timed out after ${DEFAULT_TIMEOUTS.API_CALL}ms`
        );
        
        // Check if request was aborted or component unmounted
        if (signal.aborted || !isMounted.current || requestId !== syncRequestId.current) {
          logger.debug(
            LogCategory.Health,
            `Request ${signal.aborted ? 'aborted' : 'stale'}, ignoring result`,
            `sync-${requestId}`,
            userId
          );
          return;
        }
        
        logger.debug(
          LogCategory.Health,
          `Health data sync completed successfully`,
          `sync-${requestId}`,
          userId,
          { 
            metricsReceived: !!metrics,
            hasSteps: !!metrics?.steps,
            hasDistance: !!metrics?.distance,
            hasCalories: !!metrics?.calories,
          }
        );
        
        // Update state with fetched data
        setData(metrics);
        setError(null);
      } catch (err) {
        handleSyncError(err, requestId);
      } finally {
        // Only update state if still mounted and request is current
        if (isMounted.current && requestId === syncRequestId.current) {
          setLoading(false);
          syncInProgress.current = false;
        }
      }
    }, 800),
    [provider, userId, healthInitState.isInitialized, error, handleSyncError]
  );
  
  /**
   * Public function to trigger health data sync
   */
  const syncHealthData = useCallback(() => {
    // Skip if sync already in progress
    if (syncInProgress.current) {
      logger.debug(
        LogCategory.Health,
        `Sync already in progress, skipping`,
        `sync-request`,
        userId
      );
      return;
    }
    
    // Generate new request ID
    const requestId = Date.now();
    syncRequestId.current = requestId;
    
    logger.debug(
      LogCategory.Health,
      `Triggering health data sync`,
      `sync-${requestId}`,
      userId
    );
    
    // Trigger debounced sync with new request ID
    debouncedSync(requestId);
  }, [debouncedSync, userId]);
  
  /**
   * Fetch data on initial mount and when dependencies change
   */
  useEffect(() => {
    if (!userId) {
      logger.warn(
        LogCategory.Health,
        `No userId available - skipping initial sync`,
        'initial-sync',
        'unknown'
      );
      setLoading(false);
      return;
    }
    
    logger.debug(
      LogCategory.Health,
      `Initial health data sync triggered`,
      'initial-sync',
      userId
    );
    
    syncHealthData();
    
    // Cleanup on unmount
    return () => {
      logger.debug(
        LogCategory.Health,
        `Cleaning up health data hook`,
        'cleanup',
        userId
      );
      
      isMounted.current = false;
      debouncedSync.cancel();
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      if (provider) {
        provider.cleanup().catch(error => {
          logger.error(
            LogCategory.Health,
            `Error during provider cleanup:`,
            'cleanup',
            userId,
            { error }
          );
        });
      }
    };
  }, [syncHealthData, userId, provider, debouncedSync]);
  
  // Return hook API
  return { 
    data,
    loading, 
    error, 
    syncHealthData,
    isInitialized: healthInitState.isInitialized
  };
};