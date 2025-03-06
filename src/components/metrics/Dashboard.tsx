import React from 'react';
import { View, ScrollView, RefreshControl, SafeAreaView, Image, Animated, Platform, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, Text, useTheme, ActivityIndicator, Portal, Dialog } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDashboardStyles } from '@/src/styles/useDashboardStyles';
import { useHealthData } from '@/src/hooks/useHealthData';
import { ErrorView } from '@/src/components/shared/ErrorView';
import { MetricCardList } from './MetricCardList';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderPermissionError } from '@/src/providers/health/types/errors';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { metricsService } from '@/src/services/metricsService';
import { leaderboardService } from '@/src/services/leaderboardService';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { DailyTotal } from '@/src/types/schemas';
import type { z } from 'zod';
import { DailyMetricScoreSchema, MetricType } from '@/src/types/schemas';
import { healthMetrics } from '@/src/config/healthMetrics';
import { calculateTotalPoints } from '@/src/utils/pointsCalculator';
type DailyMetricScore = z.infer<typeof DailyMetricScoreSchema>;
import type { HealthMetrics } from '@/src/providers/health/types/metrics';

// Add auto-refresh interval constant
const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds

// Add recovery timeout constant
const RECOVERY_TIMEOUT = 3000; // 3 seconds

// Add a deep equality check function at the top of the file, outside the component
const deepEqual = (obj1: any, obj2: any): boolean => {
  // If either is null or undefined or they are of different types
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== typeof obj2) return false;

  // For primitive types
  if (typeof obj1 !== 'object') return obj1 === obj2;

  // For arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    return obj1.every((item, index) => deepEqual(item, obj2[index]));
  }

  // For objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => 
    Object.prototype.hasOwnProperty.call(obj2, key) && 
    deepEqual(obj1[key], obj2[key])
  );
};

interface DashboardProps {
  provider: HealthProvider;
  userId: string;
  date?: string;
  showAlerts?: boolean;
}

const Header = React.memo(({ dailyTotal }: { dailyTotal: DailyTotal }) => {
  const styles = useDashboardStyles();
  const theme = useTheme();
  
  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerContent}>
        <Image
          source={require('@/assets/images/myLeraBanner.png')}
          style={styles.logo}
        />
        <View style={styles.statsContainer}>

          <View style={styles.statItem}>
            <Text style={styles.statText}>{dailyTotal.total_points} pts</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const LoadingView = React.memo(() => {
  const styles = useDashboardStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const pulseAnim = React.useRef(new Animated.Value(0.8)).current;
  const spinAnim = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.spring(pulseAnim, {
            toValue: 1,
            useNativeDriver: true,
            damping: 10,
            mass: 0.8,
            stiffness: 180,
          }),
          Animated.spring(pulseAnim, {
            toValue: 0.8,
            useNativeDriver: true,
            damping: 10,
            mass: 0.8,
            stiffness: 180,
          }),
        ])
      ),
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ),
    ]).start();
  }, []);

  return (
    <View style={[
      styles.loadingContainer,
      { paddingTop: insets.top }
    ]}>
      <View style={styles.loadingCard}>
        <Animated.View style={{
          transform: [
            { scale: pulseAnim },
            {
              rotate: spinAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg']
              })
            }
          ]
        }}>
          <ActivityIndicator
            size={Platform.OS === 'ios' ? 'large' : 48}
            color={theme.colors.primary}
          />
        </Animated.View>
        <Text style={styles.loadingText}>
          Loading your health data...
        </Text>
      </View>
    </View>
  );
});

const transformMetricsToHealthMetrics = (
  metrics: DailyMetricScore[],
  dailyTotal: DailyTotal | null,
  userId: string,
  date: string,
  existingMetrics: HealthMetrics | null = null
): HealthMetrics => {
  // Use existing timestamps if we have them, otherwise create new ones
  const now = new Date().toISOString();
  const created_at = existingMetrics?.created_at || now;
  // Only update the last_updated time, not created_at
  
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
    created_at: created_at,
    updated_at: now
  };

  metrics.forEach(metric => {
    const metricType = metric.metric_type as MetricType;
    if (metricType in result && typeof metric.value === 'number') {
      result[metricType] = metric.value;
    }
  });

  return result;
};

// Helper function to sanitize metrics for comparison by excluding changing timestamps
const sanitizeMetricsForComparison = (metrics: HealthMetrics) => {
  // Create a shallow copy to avoid modifying the original
  const sanitized = { ...metrics } as { [key: string]: any };
  
  // Delete fields that may change but don't affect the display
  delete sanitized.last_updated;
  delete sanitized.updated_at;
  
  return sanitized as HealthMetrics;
};

export const Dashboard = React.memo(function Dashboard({
  provider,
  userId,
  date = new Date().toISOString().split('T')[0],
  showAlerts = true
}: DashboardProps) {
  const styles = useDashboardStyles();
  const theme = useTheme();
  const { healthPermissionStatus, requestHealthPermissions, user } = useAuth();
  const [dailyTotal, setDailyTotal] = useState<DailyTotal | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataInitialized, setDataInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Add state for tracking last fetch time
  const [lastFetchTime, setLastFetchTime] = useState(0);
  
  // Replace fetchId state with a ref to avoid infinite update loops
  const fetchIdRef = useRef(0);
  
  // Add proper AppState tracking ref to fix linter error
  const appStateRef = useRef(AppState.currentState);
  
  // Add a static flag to track global initialization state - this persists beyond component unmount/remount
  const dashboardInitRef = useRef({
    globalInitialized: false
  });

  // Add a timer ref for auto-refresh
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Reference to track if current refresh is manual
  const isManualRefreshRef = useRef<boolean>(false);
  
  // Add abort controller ref for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Get the health data from the provider
  const { loading, error, syncHealthData, isInitialized } = useHealthData(provider, userId);
  
  const headerOpacity = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-20)).current;

  // Define these functions directly, not in useCallback
  const createDefaultHealthMetrics = (): HealthMetrics => ({
    steps: 0,
    distance: 0,
    calories: 0,
    heart_rate: 0,
    basal_calories: 0,
    flights_climbed: 0,
    exercise: 0,
    user_id: userId,
    date: date,
    daily_score: 0,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    id: `${userId}-${date}`,
    weekly_score: 0,
    streak_days: 0,
    last_updated: new Date().toISOString()
  });

  const createDefaultDailyTotal = (): DailyTotal => ({
    id: `${userId}-${date}`,
    user_id: userId,
    date: date,
    total_points: 0,
    metrics_completed: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // Add missing refs
  const isMounted = useRef(true);
  const isSyncInProgress = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (dailyTotal) {
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 12,
          mass: 0.8,
          stiffness: 180,
        }),
      ]).start();
    }
  }, [dailyTotal, headerOpacity, slideAnim]);

  // Set up cleanup on component mount/unmount
  useEffect(() => {
    // Create a new AbortController for this component instance
    abortControllerRef.current = new AbortController();
    
    console.log('[Dashboard] Component mounted, global init state:', dashboardInitRef.current.globalInitialized);
    
    return () => {
      console.log('[Dashboard] Component unmounting');
      
      // Signal abort to cancel any pending operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Clear auto-refresh timer on unmount
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, []);

  const fetchData = useCallback(async (requestId: number) => {
    // Don't proceed if component isn't initialized, no user ID
    if (!userId) {
      console.log('[Dashboard] Skipping fetch - missing userId');
      return;
    }
    
    // If health data isn't initialized yet, we'll still proceed but with a warning
    if (!isInitialized) {
      console.log('[Dashboard] Warning: Fetching without health initialization - some metrics may be incomplete');
    }
    
    // Skip if we've already done the global initialization
    if (dashboardInitRef.current.globalInitialized && requestId < 3) {
      console.log('[Dashboard] Skipping redundant fetch - already initialized globally');
      return;
    }
    
    // Prevent too frequent refreshes
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    if (timeSinceLastFetch < 2000 && dataInitialized && !isManualRefreshRef.current) {
      console.log('[Dashboard] Skipping fetch - too soon after previous fetch');
      return;
    }
    
    // Set loading state
    setIsLoading(true);
    
    // Only set refreshing state for manual refreshes
    if (isManualRefreshRef.current) {
      setIsRefreshing(true);
    }
    
    setLastFetchTime(now);
    console.log(`[Dashboard] Starting fetch for requestId: ${requestId}, manual refresh: ${isManualRefreshRef.current}`);
    
    try {
      // Create a new signal for this fetch request
      const signal = abortControllerRef.current?.signal;
      
      // Once we've successfully completed a fetch, mark global init as done
      dashboardInitRef.current.globalInitialized = true;
      
      console.log('Dashboard fetching data for:', { userId, date, requestId, isManualRefresh: isManualRefreshRef.current });
      const [totals, metricScores, rank] = await Promise.all([
        metricsService.getDailyTotals(date),
        metricsService.getDailyMetrics(userId, date),
        leaderboardService.getUserRank(userId, date)
      ]);
      
      // Check if this response is stale or if the component has been unmounted
      if (requestId !== fetchIdRef.current || signal?.aborted) {
        console.log('[Dashboard] Stale data response or component unmounted, ignoring');
        return;
      }
      
      // Keep original structure without modifications
      const userTotal = {
        id: `${userId}-${date}`,
        user_id: userId,
        date: date,
        total_points: calculateTotalPoints(metricScores),
        metrics_completed: metricScores.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Transform metrics but don't update state yet
      const transformedMetrics = transformMetricsToHealthMetrics(
        metricScores, 
        userTotal, 
        userId, 
        date, 
        healthMetrics
      );
      
      // Don't update state if the component has been unmounted
      if (signal?.aborted) return;
      
      // Update state directly without complex comparisons
      console.log('[Dashboard] Updating dashboard state...');
      
      // Clear any previous errors
      setFetchError(null);
      
      // Update all state at once to prevent partial updates
      setUserRank(rank);
      setDailyTotal(userTotal);
      setHealthMetrics(transformedMetrics);
      
      // Mark data as initialized
      setDataInitialized(true);
      
      console.log('[Dashboard] Dashboard state updated successfully');
      
    } catch (err) {
      console.error('[Dashboard] Error fetching dashboard data:', err);
      
      // Only update error state if the request is still current and component is mounted
      if (requestId === fetchIdRef.current && !abortControllerRef.current?.signal.aborted) {
        setFetchError(err instanceof Error ? err : new Error('Failed to fetch dashboard data'));
      }
    } finally {
      // Always reset the fetch in progress flag
      setIsLoading(false);
      
      // Always reset refreshing state if this was a manual refresh
      if (isManualRefreshRef.current && !abortControllerRef.current?.signal.aborted) {
        console.log('[Dashboard] Resetting manual refresh state');
        setIsRefreshing(false);
        isManualRefreshRef.current = false;
      }
    }
  }, [userId, date, isInitialized, healthMetrics, calculateTotalPoints, dataInitialized, lastFetchTime]);

  // Setup auto-refresh timer
  useEffect(() => {
    // Skip if not initialized or data is not yet loaded
    if (!isInitialized || !dataInitialized) {
      return undefined;
    }
    
    console.log('[Dashboard] Setting up auto-refresh timer');
    
    autoRefreshTimerRef.current = setInterval(() => {
      // Only refresh if component has mounted data and is in the foreground and not already loading
      if (appStateRef.current === 'active' && !isLoading) {
        // Explicitly mark this as NOT a manual refresh
        isManualRefreshRef.current = false;
        
        console.log('[Dashboard] Auto-refresh triggered');
        const newFetchId = fetchIdRef.current + 1;
        fetchIdRef.current = newFetchId;
        
        // Don't set isRefreshing state for automatic refreshes
        // This prevents the pull-to-refresh indicator from showing
        fetchData(newFetchId);
      }
    }, AUTO_REFRESH_INTERVAL);
    
    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [fetchData, isInitialized, dataInitialized, isLoading]);

  // Fix AppState listener effect to prevent multiple fetches
  useEffect(() => {
    // Register for app state changes
    const subscription = AppState.addEventListener('change', nextAppState => {
      const prevState = appStateRef.current;
      appStateRef.current = nextAppState;
      
      // Only refresh when coming from background to active
      if (
        prevState.match(/inactive|background/) && 
        nextAppState === 'active' &&
        dataInitialized && 
        !isLoading // Don't start a new fetch if one is in progress
      ) {
        console.log('[Dashboard] App has come to the foreground - refreshing dashboard data');
        
        // Coming back to foreground is NOT a manual refresh
        isManualRefreshRef.current = false;
        
        // Use incremented request ID to track this specific fetch request
        const newFetchId = fetchIdRef.current + 1;
        fetchIdRef.current = newFetchId;
        
        // First sync health data to get latest from device
        syncHealthData();
        
        // Then fetch dashboard data after a short delay to allow sync to complete
        setTimeout(() => {
          // Check if component is still mounted and a fetch is not already in progress
          if (!abortControllerRef.current?.signal.aborted && !isLoading) {
            fetchData(newFetchId);
          }
        }, 1000);
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [fetchData, syncHealthData, dataInitialized, isLoading]);

  useEffect(() => {
    // Don't trigger a fetch if one is already in progress
    if (isLoading) {
      console.log('[Dashboard] Skipping initial fetch - fetch already in progress');
      return;
    }
    
    // If data is already initialized and not explicitly refreshing, skip
    if (dataInitialized && !isRefreshing) {
      console.log('[Dashboard] Skipping initial fetch - data already initialized');
      return;
    }
    
    // Set loading state for first fetch
    if (!dataInitialized) {
      setIsLoading(true);
    }
    
    // Increment fetch ID in the ref without triggering re-renders
    fetchIdRef.current += 1;
    const currentFetchId = fetchIdRef.current;
    
    // Explicitly mark initial load as not a manual refresh
    isManualRefreshRef.current = false;
    
    // Call fetchData with current request ID
    fetchData(currentFetchId);
  }, [fetchData, isInitialized, user?.user_metadata?.measurementSystem, dataInitialized, isRefreshing]);

  const handleRetry = React.useCallback(async () => {
    if (error instanceof HealthProviderPermissionError) {
      const status = await requestHealthPermissions();
      if (status === 'granted') {
        syncHealthData();
      }
    } else {
      syncHealthData();
    }
    setErrorDialogVisible(false);
  }, [error, requestHealthPermissions, syncHealthData]);

  // Add recovery mechanism earlier in the component lifecycle
  useEffect(() => {
    const recoveryTimer = setTimeout(() => {
      if (!healthMetrics && isLoading) {
        console.log('[Dashboard] Recovery mechanism triggered - resetting state');
        
        // Create default data immediately
        const defaultTotal = createDefaultDailyTotal();
        const defaultMetrics = createDefaultHealthMetrics();
        
        // Update state with default data
        setDailyTotal(defaultTotal);
        setHealthMetrics(defaultMetrics);
        setIsLoading(false);
        setIsRefreshing(false);
        
        // Schedule a background refresh
        setTimeout(() => {
          if (isMounted.current && !isSyncInProgress.current) {
            console.log('[Dashboard] Attempting background refresh after recovery');
            fetchIdRef.current += 1;
            isManualRefreshRef.current = false;
            fetchData(fetchIdRef.current);
          }
        }, 1000);
      }
    }, RECOVERY_TIMEOUT);
    
    return () => clearTimeout(recoveryTimer);
  }, [healthMetrics, isLoading]);

  // Add additional safeguard for fetch operations
  const safeFetch = useCallback(async (requestId: number) => {
    if (!isMounted.current || isSyncInProgress.current) {
      console.log('[Dashboard] Skipping fetch - component unmounted or sync in progress');
      return false;
    }

    try {
      isSyncInProgress.current = true;
      await fetchData(requestId);
      return true;
    } catch (error) {
      console.error('[Dashboard] Error during fetch:', error);
      return false;
    } finally {
      isSyncInProgress.current = false;
    }
  }, [fetchData]);

  // Modify the handleRefresh to use safeFetch
  const handleRefresh = useCallback(() => {
    if (isLoading) {
      console.log('[Dashboard] Manual refresh requested but fetch already in progress');
      return;
    }
    
    isManualRefreshRef.current = true;
    setIsRefreshing(true);
    setIsLoading(true);
    
    fetchIdRef.current += 1;
    safeFetch(fetchIdRef.current).finally(() => {
      if (isMounted.current) {
        setIsRefreshing(false);
      }
    });
  }, [isLoading, safeFetch]);

  // Use our isLoading state instead of the prop from useHealthData
  if (isLoading && !dataInitialized) {
    return <LoadingView />;
  }

  if (error || healthPermissionStatus === 'denied' || fetchError) {
    return <ErrorView error={error || fetchError || new Error('Unknown error')} onRetry={handleRetry} />;
  }

  return (
    <SafeAreaView 
      style={[
        styles.container, 
        { 
          backgroundColor: theme.colors.background,
          paddingTop: Platform.OS === 'ios' ? 0 : 4
        }
      ]}
    >
      {dailyTotal && (
        <Animated.View 
          style={[
            styles.headerWrapper,
            {
              opacity: headerOpacity,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Header dailyTotal={dailyTotal} />
        </Animated.View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
      >
        {healthMetrics && (
          <MetricCardList 
            metrics={healthMetrics} 
            showAlerts={showAlerts}
            provider={provider}
            isInitialLoad={!dashboardInitRef.current.globalInitialized}
            isManualRefresh={isManualRefreshRef.current}
          />
        )}
      </ScrollView>

      <Portal>
        <Dialog 
          visible={errorDialogVisible} 
          onDismiss={() => setErrorDialogVisible(false)}
          style={{
            borderRadius: 24,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Dialog.Title 
            style={{ 
              textAlign: 'center',
              color: theme.colors.error,
              fontSize: 20,
              fontWeight: '600',
              letterSpacing: 0.5,
            }}
          >
            Error
          </Dialog.Title>
          <Dialog.Content>
            <Text 
              style={{ 
                textAlign: 'center',
                color: theme.colors.onSurface,
                fontSize: 16,
                lineHeight: 24,
                letterSpacing: 0.25,
              }}
            >
              Failed to fetch health metrics. Please try again.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: 'center', paddingBottom: 8 }}>
            <Text 
              onPress={() => setErrorDialogVisible(false)} 
              style={{ 
                color: theme.colors.primary,
                padding: 12,
                fontSize: 16,
                fontWeight: '600',
                letterSpacing: 0.5,
              }}
            >
              OK
            </Text>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
});