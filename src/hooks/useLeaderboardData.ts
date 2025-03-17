import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { leaderboardService } from '@/src/services/leaderboardService';
import { DateUtils } from '@/src/utils/DateUtils';
import { useErrorHandler } from './useErrorHandler';
import type { LeaderboardEntry, LeaderboardTimeframe } from '@/src/types/leaderboard';

/**
 * Custom hook for fetching and managing leaderboard data
 * 
 * @param userId The user ID to highlight in the leaderboard
 * @param initialTimeframe The initial timeframe to fetch data for
 * @returns Object containing leaderboard data and functions to manage it
 */
export const useLeaderboardData = (
  userId: string | null | undefined,
  initialTimeframe: LeaderboardTimeframe = 'daily'
) => {
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>(initialTimeframe);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { error, handleError, clearError } = useErrorHandler();
  
  const appStateRef = useRef(AppState.currentState);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Load leaderboard data from the server
   */
  const loadData = useCallback(async (showLoading = true) => {
    if (!userId || !isMountedRef.current) {
      console.log('[useLeaderboardData] No user found or component unmounted');
      return;
    }
    
    // Cancel any in-progress requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create a new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    if (showLoading && isMountedRef.current) setLoading(true);
    if (isMountedRef.current) clearError();
    
    try {
      const today = DateUtils.getLocalDateString();
      console.log('[useLeaderboardData] Fetching leaderboard for:', { timeframe, date: today });
      
      const data = timeframe === 'daily' 
        ? await leaderboardService.getDailyLeaderboard(today)
        : await leaderboardService.getWeeklyLeaderboard(today);
        
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      setLeaderboardData(data);
    } catch (err) {
      // Don't update state if the request was aborted or component unmounted
      if (!isMountedRef.current) return;
      
      // Don't treat aborted requests as errors
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('[useLeaderboardData] Leaderboard request was aborted');
        return;
      }
      
      handleError(err);
    } finally {
      // Only update loading state if component is still mounted
      if (showLoading && isMountedRef.current) setLoading(false);
    }
  }, [userId, timeframe, clearError, handleError]);

  /**
   * Handle app state changes (background/foreground)
   */
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === 'active' &&
      isMountedRef.current
    ) {
      console.log('[useLeaderboardData] App has come to foreground, refreshing leaderboard');
      loadData(false);
    }
    appStateRef.current = nextAppState;
  }, [loadData]);

  /**
   * Refresh leaderboard data
   */
  const onRefresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setRefreshing(true);
    
    try {
      await loadData(false);
    } catch (error) {
      console.error("[useLeaderboardData] Error during refresh:", error);
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [loadData]);

  /**
   * Change the timeframe and reload data
   */
  const changeTimeframe = useCallback((newTimeframe: LeaderboardTimeframe) => {
    setTimeframe(newTimeframe);
  }, []);

  // Load data when the component mounts or when dependencies change
  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;
    
    if (userId) {
      loadData();
      
      const subscription = AppState.addEventListener('change', handleAppStateChange);
      
      return () => {
        // Set unmounted flag
        isMountedRef.current = false;
        
        // Cancel any in-progress requests
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        
        // Remove app state listener
        subscription.remove();
      };
    }
  }, [userId, loadData, handleAppStateChange, timeframe]);

  // Reload data when timeframe changes
  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [timeframe, userId, loadData]);

  return {
    timeframe,
    leaderboardData,
    loading,
    error,
    refreshing,
    onRefresh,
    changeTimeframe,
    loadData
  };
};
