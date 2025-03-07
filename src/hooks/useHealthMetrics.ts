import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import type { DailyTotal, DailyMetricScore, MetricType } from '@/src/types/schemas';
import type { HealthMetrics } from '@/src/providers/health/types/metrics';
import { metricsService } from '@/src/services/metricsService';
import { leaderboardService } from '@/src/services/leaderboardService';
import { calculateTotalPoints } from '@/src/utils/pointsCalculator';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { useHealthData } from '@/src/hooks/useHealthData';

/**
 * Custom hook for fetching and processing health metrics data
 */
export const useHealthMetrics = (
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
  
  // Use the health data hook
  const {
    loading,
    error,
    syncHealthData,
    isInitialized
  } = useHealthData(provider, userId);

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
    if (!isInitialized || !userId || isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    setIsRefreshing(true);
    
    try {
      console.log('Fetching health metrics data for:', { userId, date, requestId });
      const [totals, metricScores, rank] = await Promise.all([
        metricsService.getDailyTotals(date),
        metricsService.getDailyMetrics(userId, date),
        leaderboardService.getUserRank(userId, date)
      ]);
      
      // Check if this response is stale
      if (requestId !== fetchIdRef.current) {
        console.log('Stale data response, ignoring');
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
      
      setDailyTotal(userTotal);
      setHealthMetrics(transformMetricsToHealthMetrics(metricScores, userTotal, userId, date));
      setUserRank(rank);
      setFetchError(null);
    } catch (err) {
      // Only handle errors from current request
      if (requestId !== fetchIdRef.current) return;
      console.error('Error fetching metrics:', err);
      setFetchError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
      setErrorDialogVisible(true);
    } finally {
      if (requestId === fetchIdRef.current) {
        setIsRefreshing(false);
        isFetchingRef.current = false;
      }
    }
  }, [userId, date, isInitialized, transformMetricsToHealthMetrics]);

  /**
   * Refresh metrics data manually
   */
  const refreshData = useCallback(() => {
    fetchIdRef.current += 1;
    syncHealthData();
    fetchData(fetchIdRef.current);
  }, [syncHealthData, fetchData]);

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
    if (isInitialized) {
      fetchIdRef.current += 1;
      fetchData(fetchIdRef.current);
    }
  }, [fetchData, isInitialized]);

  return {
    dailyTotal,
    healthMetrics,
    loading,
    error: error || fetchError,
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