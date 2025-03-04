import React from 'react';
import { View, ScrollView, RefreshControl, SafeAreaView, Image, Animated, Platform, AppState, AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, useTheme, ActivityIndicator, Portal, Dialog } from 'react-native-paper';
import { useDashboardStyles } from '@/src/styles/useDashboardStyles';
import { useHealthData } from '@/src/hooks/useHealthData';
import { ErrorView } from '@/src/components/shared/ErrorView';
import { MetricCardList } from './MetricCardList';
import { useAuth } from '@/src/providers/AuthProvider';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { metricsService } from '@/src/services/metricsService';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { DailyTotal } from '@/src/types/schemas';
import type { z } from 'zod';
import { DailyMetricScoreSchema, MetricType } from '@/src/types/schemas';
import type { HealthMetrics } from '@/src/providers/health/types/metrics';

// Define DailyMetricScore type using the schema
type DailyMetricScore = z.infer<typeof DailyMetricScoreSchema>;

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
};

// Create a properly typed empty metrics object
const createEmptyHealthMetrics = (userId: string, date: string): HealthMetrics => ({
  id: `empty-${userId}-${date}`,
  user_id: userId,
  date: date,
  steps: 0,
  distance: 0, 
  calories: 0,
  heart_rate: 0,
  basal_calories: 0,
  flights_climbed: 0,
  exercise: 0,
  daily_score: 0,
  weekly_score: null,
  streak_days: null,
  last_updated: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

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
  
  // Replace fetchId state with a ref to avoid infinite update loops
  const fetchIdRef = useRef(0);
  const isFetchingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const mountedRef = useRef(false);
  
  const {
    loading,
    error,
    syncHealthData,
    isInitialized
  } = useHealthData(provider, userId);

  const headerOpacity = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-20)).current;

  // Add a timestamp ref to prevent frequent refetches
  const lastFetchTimeRef = useRef(0);
  
  // Set mounted state
  useEffect(() => {
    mountedRef.current = true;
    console.log('[Dashboard] Component mounted');
    
    return () => {
      mountedRef.current = false;
      console.log('[Dashboard] Component unmounted');
    };
  }, []);
  
  // Add safety timeout for loading state
  useEffect(() => {
    let mounted = true;
    const safetyTimer = setTimeout(() => {
      if (mounted && loading && !dailyTotal) {
        console.log('[Dashboard] Safety timeout triggered - resolving loading state');
        setIsRefreshing(false);
        isFetchingRef.current = false;
        
        // If we still have no data, try to do a manual fetch
        if (!dailyTotal && !isFetchingRef.current) {
          fetchData();
        }
      }
    }, 10000); // 10 seconds max loading time
    
    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
    };
  }, [loading, dailyTotal]);
  
  // Function to fetch data - improved with better error handling
  const fetchData = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;
    const now = Date.now();
    
    // Prevent duplicate fetches
    if (isFetchingRef.current) {
      console.log('[Dashboard] Already fetching data, skipping duplicate fetch request');
      return;
    }
    
    // Throttle fetches
    if (now - lastFetchTimeRef.current < 2000) {
      console.log('[Dashboard] Fetch throttled, skipping');
      return;
    }
    
    lastFetchTimeRef.current = now;
    isFetchingRef.current = true;
    
    console.log(`Dashboard: Starting data fetch, ID: ${currentFetchId}`);
    console.log('Dashboard fetching data for:', { userId, date, requestId: currentFetchId });
    
    try {
      // Fetch daily metrics - with a timeout for safety
      const dailyMetricsPromise = metricsService.getDailyMetrics(userId, date);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Daily metrics fetch timeout')), 5000)
      );
      
      const dailyMetrics = await Promise.race([dailyMetricsPromise, timeoutPromise])
        .catch(err => {
          console.warn(`[Dashboard] Error fetching daily metrics: ${err.message}`);
          return [] as DailyMetricScore[]; // Return empty array instead of null
        });
      
      // Fetch daily totals - with a timeout for safety
      const dailyTotalsPromise = metricsService.getDailyTotals(date);
      const totalsTimeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Daily totals fetch timeout')), 5000)
      );
      
      const dailyTotalsResult = await Promise.race([dailyTotalsPromise, totalsTimeoutPromise])
        .catch(err => {
          console.warn(`[Dashboard] Error fetching daily totals: ${err.message}`);
          return null;
        });
      
      // Check if this is still the latest fetch request
      if (!mountedRef.current || currentFetchId !== fetchIdRef.current) {
        console.log(`[Dashboard] Fetch ${currentFetchId} superseded, discarding results`);
        return;
      }
      
      // Process daily metrics
      if (Array.isArray(dailyMetrics) && dailyMetrics.length > 0) {
        const healthMetricsData = transformMetricsToHealthMetrics(
          dailyMetrics,
          dailyTotalsResult as DailyTotal | null,
          userId,
          date
        );
        setHealthMetrics(healthMetricsData);
      } else {
        console.log('[Dashboard] No daily metrics found, using empty data');
        // Initialize with empty metrics to prevent loading state
        setHealthMetrics(createEmptyHealthMetrics(userId, date));
      }
      
      // Set daily total data
      if (dailyTotalsResult && Array.isArray(dailyTotalsResult) && dailyTotalsResult.length > 0) {
        // If it's an array, use the first item (newest)
        setDailyTotal({
          id: dailyTotalsResult[0].id,
          user_id: dailyTotalsResult[0].user_id,
          date: dailyTotalsResult[0].date,
          total_points: dailyTotalsResult[0].total_points,
          metrics_completed: dailyTotalsResult[0].metrics_completed,
          created_at: dailyTotalsResult[0].created_at,
          updated_at: dailyTotalsResult[0].updated_at
        });
      } else if (dailyTotalsResult && !Array.isArray(dailyTotalsResult)) {
        // If it's a single object
        setDailyTotal(dailyTotalsResult as DailyTotal);
      }
      
      setFetchError(null);
      
      console.log(`[Dashboard] Fetch ${currentFetchId} completed successfully`);
      
    } catch (err) {
      if (!mountedRef.current) return;
      
      console.error('[Dashboard] Error fetching data:', err);
      setFetchError(err instanceof Error ? err : new Error(String(err)));
      
      // Set empty metrics to prevent eternal loading
      if (!healthMetrics) {
        setHealthMetrics(createEmptyHealthMetrics(userId, date));
      }
    } finally {
      if (mountedRef.current) {
        isFetchingRef.current = false;
        setIsRefreshing(false);
      }
    }
  }, [userId, date, healthMetrics]);
  
  // Modified fetch on mount and when dependencies change
  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [fetchData, userId, date]);
  
  // Slightly delay refresh of health data to avoid collision with fetch
  useEffect(() => {
    if (dailyTotal) {
      // If we already have data, a small delay before syncing health
      const timer = setTimeout(() => {
        syncHealthData();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [syncHealthData, dailyTotal]);
  
  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[Dashboard] App has come to the foreground, refreshing');
        fetchData();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [fetchData]);

  // Function to handle manual refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
    syncHealthData();
  }, [fetchData, syncHealthData]);

  // Function to handle retrying after an error
  const handleRetry = useCallback(() => {
    fetchData();
    syncHealthData();
  }, [fetchData, syncHealthData]);

  // Add effect to animate header when dailyTotal is set
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

  // Modified loading state behavior
  if (loading && !dailyTotal) {
    // Only show loading if we don't have any data yet
    return <LoadingView />;
  }

  // Show error view only if we have a critical error and no data to display
  if ((error && error.name !== 'HealthProviderPermissionError') && 
      healthPermissionStatus === 'denied' && !dailyTotal) {
    return <ErrorView error={error || fetchError || new Error('Unknown error')} onRetry={handleRetry} />;
  }

  // Always render once data is available, even with minor errors
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
              {error?.message || fetchError?.message || 'Failed to fetch health metrics. Please try again.'}
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
