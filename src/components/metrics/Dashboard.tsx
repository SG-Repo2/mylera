import React from 'react';
import { View, ScrollView, RefreshControl, SafeAreaView, Animated, Platform, AppState, AppStateStatus, StyleSheet } from 'react-native';
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
import { Image } from 'expo-image';
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
  
  const fetchIdRef = useRef(0);
  const isFetchingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const mountedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchTimeRef = useRef(0);
  
  const {
    loading,
    error,
    syncHealthData,
    isInitialized
  } = useHealthData(provider, userId);

  const headerOpacity = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-20)).current;
  
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
  
  // Function to fetch data - improved with better error handling and race condition fixes
  const fetchData = useCallback(async () => {
    // Create new controller for this request
    const abortController = new AbortController();
    const signal = abortController.signal;
    
    // Store reference to abort controller
    abortControllerRef.current = abortController;
    
    // Prevent duplicate fetches with better tracking
    if (isFetchingRef.current) {
      console.log('[Dashboard] Already fetching data, skipping duplicate fetch request');
      return;
    }
    
    const now = Date.now();
    lastFetchTimeRef.current = now;
    isFetchingRef.current = true;
    
    try {
      // Use Promise.all with AbortController signal
      const [dailyMetrics, dailyTotals] = await Promise.all([
        fetchWithTimeout(
          () => metricsService.getDailyMetrics(userId, date),
          5000, // 5 second timeout
          signal
        ),
        fetchWithTimeout(
          () => metricsService.getDailyTotals(date),
          5000,
          signal
        )
      ]);
      
      // Process metrics data
      if (mountedRef.current) {
        // Process daily metrics
        if (Array.isArray(dailyMetrics) && dailyMetrics.length > 0) {
          const healthMetricsData = transformMetricsToHealthMetrics(
            dailyMetrics,
            dailyTotals as DailyTotal | null,
            userId,
            date
          );
          setHealthMetrics(healthMetricsData);
        } else {
          console.log('[Dashboard] No daily metrics found, using empty data');
          setHealthMetrics(createEmptyHealthMetrics(userId, date));
        }

        // Set daily total data
        if (dailyTotals && Array.isArray(dailyTotals) && dailyTotals.length > 0) {
          setDailyTotal({
            id: dailyTotals[0].id,
            user_id: dailyTotals[0].user_id,
            date: dailyTotals[0].date,
            total_points: dailyTotals[0].total_points,
            metrics_completed: dailyTotals[0].metrics_completed,
            created_at: dailyTotals[0].created_at,
            updated_at: dailyTotals[0].updated_at
          });
        } else if (dailyTotals && !Array.isArray(dailyTotals)) {
          setDailyTotal(dailyTotals as DailyTotal);
        }

        setFetchError(null);
      }

      // Ensure daily total exists for new users
      if (!dailyTotal) {
        console.log('[Dashboard] No daily total found, creating default');
        const dailyTotalData = await metricsService.ensureDailyTotalExists(userId, date);
        setDailyTotal(dailyTotalData);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
        console.log('[Dashboard] Fetch aborted');
        return;
      }
      
      console.error('[Dashboard] Error fetching data:', err);
      setFetchError(err instanceof Error ? err : new Error('Unknown error fetching data'));
      setIsRefreshing(false);
      isFetchingRef.current = false;
      
      // Ensure we have fallback data even on errors
      if (!dailyTotal) {
        setDailyTotal({
          id: `error-${userId}-${date}`,
          user_id: userId,
          date,
          total_points: 0,
          metrics_completed: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
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

  // Helper function for timeout
  const fetchWithTimeout = async (fetchFn: { (): Promise<any[]>; (): Promise<{ id: any; user_id: any; date: any; total_points: any; metrics_completed: any; created_at: any; updated_at: any; user_profiles: { display_name: any; avatar_url: any; show_profile: any; }[]; }[]>; (arg0: { aborted: boolean; addEventListener: (type: any, listener: any) => void; removeEventListener: (type: any, listener: any) => void; }): any; }, timeout: number | undefined, signal: AbortSignal) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      // Create a signal that aborts if either the timeout or parent signal aborts
      const combinedSignal = {
        aborted: false,
        addEventListener: (type: string, listener: (this: AbortSignal, ev: Event) => any) => {
          if (type !== 'abort') return;
          controller.signal.addEventListener('abort', listener);
          signal?.addEventListener('abort', listener);
        },
        removeEventListener: (type: string, listener: (this: AbortSignal, ev: Event) => any) => {
          if (type !== 'abort') return;
          controller.signal.removeEventListener('abort', listener);
          signal?.removeEventListener('abort', listener);
        }
      };
      
      return await fetchFn(combinedSignal);
    } finally {
      clearTimeout(timeoutId);
    }
  };
  
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

  // Add fallback mechanism for new users with no data
  useEffect(() => {
    // Create a default dailyTotal if we have metrics but no totals
    if (healthMetrics && !dailyTotal && !loading) {
      console.log('[Dashboard] Creating default dailyTotal for new user');
      setDailyTotal({
        id: `default-${userId}-${date}`,
        user_id: userId,
        date: date,
        total_points: 0,
        metrics_completed: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }, [healthMetrics, dailyTotal, loading, userId, date]);

  // Modified loading state behavior
  if (loading && !dailyTotal && !healthMetrics) {
    // Only show loading if we have no data at all
    return <LoadingView />;
  }

  // Use a default dailyTotal if none exists
  const effectiveDailyTotal = dailyTotal || {
    id: `default-${userId}-${date}`,
    user_id: userId,
    date: date,
    total_points: 0,
    metrics_completed: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

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
      {error ? (
        <ErrorView error={error} onRetry={fetchData} />
      ) : (
        <View style={{ flex: 1 }}>
          {healthMetrics && (
            <>
              <Animated.View style={[styles.headerWrapper, { transform: [{ translateY: slideAnim }] }]}>
                <Header dailyTotal={effectiveDailyTotal} />
              </Animated.View>
              
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
                <MetricCardList 
                  metrics={healthMetrics} 
                  showAlerts={showAlerts}
                  provider={provider}
                />
              </ScrollView>
            </>
          )}
        </View>
      )}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  // ... other existing styles ...
});
