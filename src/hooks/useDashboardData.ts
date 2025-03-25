import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import type { DailyTotal, DailyMetricScore, MetricType } from '@/src/types/schemas';
import type { HealthMetrics } from '@/src/providers/health/types/metrics';
import { metricsService } from '@/src/services/metricsService';
import { leaderboardService } from '@/src/services/leaderboardService';
import { calculateTotalPoints } from '@/src/utils/pointsCalculator';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { useHealthSync } from './useHealthSync';

// Define type for cached dashboard data
interface CachedDashboardData {
  dailyTotal: DailyTotal | null;
  healthMetrics: HealthMetrics | null;
  userRank: number | null;
}

// Cache implementation for metrics data
const metricsCache = new Map<string, {data: CachedDashboardData, timestamp: number}>();
const CACHE_TTL = 60000; // 1 minute cache lifetime

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
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
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
   * Memoized with no dependencies to prevent unnecessary recalculations
   */
  const transformMetricsToHealthMetrics = useCallback((
    metrics: DailyMetricScore[],
    dailyTotal: DailyTotal | null,
    userId: string,
    date: string
  ): HealthMetrics => {
    const now = new Date().toISOString();
    
    // Create base metrics object
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

    // Log incoming metrics for debugging
    console.log('[useDashboardData] Processing metrics:', metrics);

    // Process each metric
    metrics.forEach(metric => {
      const metricType = metric.metric_type as MetricType;
      if (metricType in result) {
        // Ensure value is a number and valid
        const value = typeof metric.value === 'number' ? metric.value : parseFloat(metric.value as string);
        if (!isNaN(value)) {
          result[metricType] = value;
          console.log(`[useDashboardData] Setting ${metricType}:`, value);
        }
      }
    });

    // Log final transformed metrics
    console.log('[useDashboardData] Transformed metrics:', result);
    return result;
  }, []); // No dependencies needed to prevent unnecessary recalculations

  /**
   * Helper to extract valid metrics from provider data
   */
  const getValidMetrics = (providerMetrics: HealthMetrics): Partial<Record<MetricType, number>> => {
    const metricValues: Partial<Record<MetricType, number>> = {
      steps: providerMetrics.steps || undefined,
      distance: providerMetrics.distance || undefined,
      calories: providerMetrics.calories || undefined,
      heart_rate: providerMetrics.heart_rate || undefined,
      exercise: providerMetrics.exercise || undefined,
      basal_calories: providerMetrics.basal_calories || undefined,
      flights_climbed: providerMetrics.flights_climbed || undefined
    };

    // Filter out null/undefined values
    return Object.fromEntries(
      Object.entries(metricValues).filter(([_, value]) => value !== null && value !== undefined)
    ) as Partial<Record<MetricType, number>>;
  };

  /**
   * Helper to process and update metrics to avoid duplicate logic
   */
  const processAndUpdateMetrics = async (userId: string, providerMetrics: HealthMetrics | null) => {
    if (!providerMetrics) return;

    const metricValues = getValidMetrics(providerMetrics);

    if (Object.keys(metricValues).length > 0) {
      return metricsService.updateMetrics(userId, metricValues);
    }
  };

  /**
   * Helper to get cached metrics
   */
  const getCachedMetrics = (userId: string, date: string): CachedDashboardData | null => {
    const cacheKey = `${userId}-${date}`;
    const cached = metricsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }
    return null;
  };

  /**
   * Helper to set cached metrics
   */
  const setCachedMetrics = (userId: string, date: string, data: CachedDashboardData) => {
    const cacheKey = `${userId}-${date}`;
    metricsCache.set(cacheKey, { data, timestamp: Date.now() });
  };

  /**
   * Fetch metrics data from API with optimized parallel requests and caching
   */
  const fetchData = useCallback(async (requestId: number) => {
    if (!isInitialized || !userId || isFetchingRef.current || !isMountedRef.current) return;
    
    isFetchingRef.current = true;
    if (isMountedRef.current) setIsRefreshing(true);
    
    try {
      console.log('[useDashboardData] Starting metrics fetch for:', { userId, date });
      
      // Fetch health data and check cache in parallel
      const [providerMetrics, cachedMetrics] = await Promise.all([
        provider.getMetrics(),
        getCachedMetrics(userId, date)
      ]);
      
      // Use cached data if available and valid
      if (cachedMetrics) {
        setDailyTotal(cachedMetrics.dailyTotal);
        setHealthMetrics(cachedMetrics.healthMetrics);
        setUserRank(cachedMetrics.userRank);
        setIsDataLoaded(true);
        return;
      }
      
      // Process metrics and update database in parallel with fetching other data
      const updatePromise = processAndUpdateMetrics(userId, providerMetrics);
      
      // Fetch daily totals, metrics, and rank in parallel
      const [totals, metricScores, rank] = await Promise.all([
        metricsService.getDailyTotals(date),
        metricsService.getDailyMetrics(userId, date),
        leaderboardService.getUserRank(userId, date),
        updatePromise // Wait for the update to complete too
      ]);

      if (!isMountedRef.current || requestId !== fetchIdRef.current) return;

      // Create user total from metric scores
      const userTotal = {
        id: `${userId}-${date}`,
        user_id: userId,
        date: date,
        total_points: calculateTotalPoints(metricScores, 'useDashboardData.fetchData'),
        metrics_completed: metricScores.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const transformedMetrics = transformMetricsToHealthMetrics(
        metricScores,
        userTotal,
        userId,
        date
      );

      // Cache the results for future use
      setCachedMetrics(userId, date, {
        dailyTotal: userTotal,
        healthMetrics: transformedMetrics,
        userRank: rank
      });

      setDailyTotal(userTotal);
      setHealthMetrics(transformedMetrics);
      setUserRank(rank);
      setFetchError(null);
      setIsDataLoaded(true);
    } catch (err) {
      if (!isMountedRef.current || requestId !== fetchIdRef.current) return;
      
      console.error('Error fetching metrics:', err);
      setFetchError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
      setIsDataLoaded(false);
    } finally {
      if (isMountedRef.current && requestId === fetchIdRef.current) {
        setIsRefreshing(false);
        isFetchingRef.current = false;
      }
    }
  }, [userId, date, isInitialized, transformMetricsToHealthMetrics, provider]);

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
        await fetchData(currentFetchId);
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
    ) : new Set(),
    isDataLoaded
  };
};
