import React from 'react';
import { View, ScrollView, RefreshControl, SafeAreaView, Image, Animated, Platform } from 'react-native';
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
import debounce from 'lodash.debounce';
import type { DailyTotal } from '@/src/types/schemas';
import type { z } from 'zod';
import { DailyMetricScoreSchema, MetricType } from '@/src/types/schemas';
import { healthMetrics } from '@/src/config/healthMetrics';
import { calculateTotalScore } from '@/src/utils/scoringUtils';
type DailyMetricScore = z.infer<typeof DailyMetricScoreSchema>;
import type { HealthMetrics } from '@/src/providers/health/types/metrics';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';

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
  totalScore: number,
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
    daily_score: totalScore,
    weekly_score: null,
    streak_days: null,
    last_updated: now,
    created_at: now,
    updated_at: now
  };

  metrics.forEach(metric => {
    const metricType = metric.metric_type as MetricType;
    if (metricType in result) { // Removed typeof check, assuming value is always present but might be string
      result[metricType] = Number(metric.value); // Explicitly convert to Number
    }
  });

  return result;
};

export const Dashboard = React.memo(function Dashboard({
  provider,
  userId,
  date = new Date().toISOString().split('T')[0],
  showAlerts = true
}: DashboardProps) {
  const { healthInitState, healthPermissionStatus } = useAuth();
  
  // Add comprehensive initialization check
  const isFullyInitialized = useCallback(() => {
    return (
      healthInitState.isInitialized &&
      !healthInitState.isInitializing &&
      healthPermissionStatus === 'granted' && 
      provider?.isInitialized()
    );
  }, [healthInitState, healthPermissionStatus, provider]);

  const styles = useDashboardStyles();
  const theme = useTheme();
  const { healthPermissionStatus: authHealthPermissionStatus, requestHealthPermissions, user } = useAuth();
  const [dailyTotal, setDailyTotal] = useState<DailyTotal | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [userRank, setUserRank] = useState<number | null>(null);
  const refreshInProgress = useRef(false);
  const {
    loading,
    error,
    syncHealthData,
    isInitialized
  } = useHealthData(provider, userId);

  const headerOpacity = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-20)).current;

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

  const fetchData = useCallback(async () => {
    if (!isFullyInitialized()) {
      console.log('[Dashboard] Not fully initialized, skipping fetch');
      return;
    }
    
    try {
      console.log('[Dashboard] Fetching data for:', { userId, date });
      const [totals, metricScores, rank] = await Promise.all([
        metricsService.getDailyTotals(date),
        metricsService.getDailyMetrics(userId, date),
        leaderboardService.getUserRank(userId, date)
      ]);
      
      console.log('[Dashboard] Daily totals:', totals);
      console.log('[Dashboard] Metric scores:', metricScores);
      
      // Calculate total score using the new scoring system
      const totalScoreResult = calculateTotalScore(
        metricScores.map(metric => ({
          metric_type: metric.metric_type,
          value: metric.value
        }))
      );
      
      console.log('[Dashboard] Calculated total score:', totalScoreResult);
      
      const userTotal = {
        id: `${userId}-${date}`,
        user_id: userId,
        date: date,
        total_points: totalScoreResult.totalPoints,
        metrics_completed: totalScoreResult.metricsCompleted,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setDailyTotal(userTotal);
      
      const transformedMetrics = transformMetricsToHealthMetrics(
        metricScores,
        totalScoreResult.totalPoints,
        userId,
        date
      );
      console.log('[Dashboard] Transformed metrics:', transformedMetrics);
      
      setHealthMetrics(transformedMetrics);
      setUserRank(rank);
      setFetchError(null);
    } catch (error) {
      console.error('[Dashboard] Fetch error:', error);
      setFetchError(error instanceof Error ? error : new Error('Fetch failed'));
    }
  }, [isFullyInitialized, userId, date]);

  useEffect(() => {
    fetchData();
  }, [fetchData, isInitialized, user?.user_metadata?.measurementSystem]);

  const handleRetry = React.useCallback(async () => {
    try {
      setErrorDialogVisible(false);
      
      // If it's a permission error, handle it first
      if (error instanceof HealthProviderPermissionError) {
        console.log('[Dashboard] Requesting health permissions...');
        const status = await requestHealthPermissions();
        if (status !== 'granted') {
          throw new Error('Health permissions are required to track your fitness metrics');
        }
        console.log('[Dashboard] Health permissions granted');
      }

      // Clean up existing provider
      console.log('[Dashboard] Cleaning up existing provider...');
      await HealthProviderFactory.cleanup();
      console.log('[Dashboard] Provider cleanup complete');
      
      // Re-initialize provider and sync data
      console.log('[Dashboard] Initializing new provider...');
      const newProvider = await HealthProviderFactory.getProvider();
      await newProvider.initialize();
      console.log('[Dashboard] New provider initialized');
      
      syncHealthData();
      console.log('[Dashboard] Health data sync triggered');
    } catch (error) {
      console.error('[Dashboard] Retry failed:', error);
      setErrorDialogVisible(true);
      setFetchError(error instanceof Error ? error : new Error('Failed to retry health data sync'));
    }
  }, [error, requestHealthPermissions, syncHealthData]);

  const debouncedRefresh = useCallback(
    debounce(async () => {
      if (refreshInProgress.current) return;
      
      refreshInProgress.current = true;
      try {
        await syncHealthData();
      } finally {
        refreshInProgress.current = false;
      }
    }, 500),
    [syncHealthData]
  );

  const handleRefresh = React.useCallback(() => {
    debouncedRefresh();
  }, [debouncedRefresh]);

  if (loading) {
    return <LoadingView />;
  }

  if (error || authHealthPermissionStatus === 'denied' || fetchError) {
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
            refreshing={loading}
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
