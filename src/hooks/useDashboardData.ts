import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import isEqual from 'lodash/isEqual';
import type { DailyTotal, DailyMetricScore, MetricType } from '@/src/types/schemas';
import type { HealthMetrics } from '@/src/providers/health/types/metrics';
import { metricsService } from '@/src/services/metricsService';
import { leaderboardService } from '@/src/services/leaderboardService';
import { calculateTotalPoints } from '@/src/utils/pointsCalculator';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { useHealthSync } from './useHealthSync';

// Add debounce utility at the top of the file
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  };
};

/**
 * Custom hook for fetching and processing health metrics data
 */
export const useDashboardData = (
  provider: HealthProvider,
  userId: string,
  date: string
) => {
  // State
  const [dailyTotal, setDailyTotal] = useState<DailyTotal | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Refs to prevent unnecessary re-renders
  const fetchIdRef = useRef(0);
  const isFetchingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const isMountedRef = useRef(true);
  
  // Use our renamed hook
  const {
    loading: healthDataLoading,
    error: healthDataError,
    syncHealthData,
    isInitialized
  } = useHealthSync(provider, userId);

  /**
   * Transform daily metric scores into HealthMetrics format
   */
  const transformMetricsToHealthMetrics = useCallback((
    metrics: DailyMetricScore[],
    dailyTotal: DailyTotal | null,
    userId: string,
    date: string
  ): HealthMetrics => {
    const now = new Date().toISOString();
    
    const result: HealthMetrics = {
      id: `${userId}-${date}`,
      user_id: userId,
      date: date,
      steps: null,
      distance: null,
      calories: null,
      heart_rate: null,
      exercise: null,
      basal_calories: null,
      flights_climbed: null,
      daily_score: dailyTotal?.total_points || 0,
      weekly_score: null,
      streak_days: null,
      last_updated: now,
      created_at: now,
      updated_at: now
    };

    metrics.forEach(metric => {
      const metricType = metric.metric_type as MetricType;
      if (metricType in result && typeof metric.value === 'number') {
        result[metricType] = metric.value;
      }
    });

    return result;
  }, []);

  /**
   * Fetch metrics data from API
   */
  const fetchData = useCallback(async (requestId: number) => {
    if (!isInitialized || !userId || isFetchingRef.current || !isMountedRef.current) return;
    
    isFetchingRef.current = true;
    if (isMountedRef.current) setIsRefreshing(true);
    
    try {
      console.log('Fetching health metrics data for:', { userId, date, requestId });
      const [totals, metricScores, rank] = await Promise.all([
        metricsService.getDailyTotals(date),
        metricsService.getDailyMetrics(userId, date),
        leaderboardService.getUserRank(userId, date)
      ]);
      
      // Check if this response is stale or component unmounted
      if (requestId !== fetchIdRef.current || !isMountedRef.current) {
        console.log('Stale data response or component unmounted, ignoring');
        return;
      }
      
      // Create user total
      const userTotal = {
        id: `${userId}-${date}`,
        user_id: userId,
        date: date,
        total_points: calculateTotalPoints(metricScores),
        metrics_completed: metricScores.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (isMountedRef.current) {
        // Only update states if data actually changed
        if (!dailyTotal || 
            dailyTotal.total_points !== userTotal.total_points || 
            dailyTotal.metrics_completed !== userTotal.metrics_completed) {
          setDailyTotal(userTotal);
        }
        
        const newHealthMetrics = transformMetricsToHealthMetrics(metricScores, userTotal, userId, date);
        if (!healthMetrics || !isEqual(healthMetrics, newHealthMetrics)) {
          setHealthMetrics(newHealthMetrics);
        }
        
        if (userRank !== rank) {
          setUserRank(rank);
        }
        
        setFetchError(null);
      }
    } catch (err) {
      // Only handle errors from current request and if component is mounted
      if (requestId !== fetchIdRef.current || !isMountedRef.current) return;
      console.error('Error fetching metrics:', err);
      setFetchError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
      setErrorDialogVisible(true);
    } finally {
      if (requestId === fetchIdRef.current && isMountedRef.current) {
        setIsRefreshing(false);
      }
      isFetchingRef.current = false;
    }
  }, [userId, date, isInitialized, transformMetricsToHealthMetrics]);

  // Create debounced version of fetchData
  const debouncedFetchData = useRef(
    debounce((requestId: number) => fetchData(requestId), 300)
  ).current;

  /**
   * Refresh metrics data manually
   */
  const refreshData = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      fetchIdRef.current += 1;
      const currentFetchId = fetchIdRef.current;
      
      // Start refreshing indicator
      if (isMountedRef.current) setIsRefreshing(true);
      
      // Sync health data first
      await syncHealthData();
      
      // Only proceed if component is still mounted and request is still valid
      if (isMountedRef.current && currentFetchId === fetchIdRef.current) {
        await debouncedFetchData(currentFetchId);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error refreshing data:', err);
        setFetchError(err instanceof Error ? err : new Error('Failed to refresh metrics'));
        setErrorDialogVisible(true);
      }
    } finally {
      // Always ensure refreshing state is reset if component is mounted
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [syncHealthData, debouncedFetchData]);

  /**
   * Handle retry after error
   */
  const handleRetry = useCallback(() => {
    syncHealthData();
    setErrorDialogVisible(false);
  }, [syncHealthData]);

  /**
   * Handle app state changes (background/foreground)
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        isMountedRef.current &&
        appStateRef.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground - refreshing health metrics data');
        fetchIdRef.current += 1;
        fetchData(fetchIdRef.current);
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [fetchData]);

  /**
   * Initial data fetch
   */
  useEffect(() => {
    if (isInitialized && isMountedRef.current) {
      fetchIdRef.current += 1;
      fetchData(fetchIdRef.current);
    }
  }, [fetchData, isInitialized]);

  /**
   * Cleanup on component unmount
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    dailyTotal,
    healthMetrics,
    loading: healthDataLoading,
    error: healthDataError || fetchError,
    userRank,
    isRefreshing,
    errorDialogVisible,
    setErrorDialogVisible,
    refreshData,
    handleRetry,
    availableMetrics: healthMetrics ? new Set(
      Object.entries(healthMetrics)
        .filter(([key, value]) => value !== null && !['id', 'user_id', 'date', 'created_at', 'updated_at', 'last_updated'].includes(key))
        .map(([key]) => key)
    ) : new Set()
  };
};