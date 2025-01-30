import React from 'react';
import { View, ScrollView, RefreshControl, SafeAreaView, StyleSheet, Image, Animated } from 'react-native';
import { Surface, Text, useTheme, ActivityIndicator, Portal, Dialog } from 'react-native-paper';
import { useHealthData } from '@/src/hooks/useHealthData';
import { ErrorView } from '@/src/components/shared/ErrorView';
import { MetricCardList } from './MetricCardList';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderPermissionError } from '@/src/providers/health/types/errors';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { metricsService } from '@/src/services/metricsService';
import { useState, useEffect } from 'react';
import type { DailyTotal } from '@/src/types/schemas';
import type { z } from 'zod';
import { DailyMetricScoreSchema } from '@/src/types/schemas';
type DailyMetricScore = z.infer<typeof DailyMetricScoreSchema>;
import type { HealthMetrics } from '@/src/providers/health/types/metrics';

interface DashboardProps {
  provider: HealthProvider;
  userId: string;
  date?: string;
  showAlerts?: boolean;
}

const LoadingView = React.memo(() => {
  const paperTheme = useTheme();
  const pulseAnim = React.useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Surface style={[styles.loadingContainer, { backgroundColor: paperTheme.colors.surface }]} elevation={2}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <ActivityIndicator size={48} color={paperTheme.colors.primary} />
      </Animated.View>
      <Text variant="titleMedium" style={[styles.loadingText, { color: paperTheme.colors.onSurfaceVariant }]}>
        Loading your health data...
      </Text>
    </Surface>
  );
});

const transformMetricsToHealthMetrics = (
  metrics: DailyMetricScore[],
  dailyTotal: DailyTotal | null,
  userId: string,
  date: string
): HealthMetrics => {
  const now = new Date().toISOString();
  type MetricType = 'steps' | 'distance' | 'calories' | 'exercise' | 'standing' | 'heart_rate' | 'sleep';

  const result: HealthMetrics = {
    id: `${userId}-${date}`,
    user_id: userId,
    date: date,
    steps: 0,
    distance: 0,
    calories: 0,
    exercise: 0,
    standing: 0,
    heart_rate: 0,
    sleep: 0,
    daily_score: dailyTotal?.total_points || 0,
    weekly_score: 0,
    streak_days: 0,
    last_updated: now,
    created_at: now,
    updated_at: now
  };

  metrics.forEach(metric => {
    const metricType = metric.metric_type as MetricType;
    if (metricType in result && typeof result[metricType] === 'number') {
      result[metricType] += metric.value;
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
  const paperTheme = useTheme();
  const { healthPermissionStatus, requestHealthPermissions } = useAuth();
  const [dailyTotal, setDailyTotal] = useState<DailyTotal | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  
  const {
    loading,
    error,
    syncHealthData
  } = useHealthData(provider, userId);

  const headerOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [dailyTotal]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [totals, metricScores] = await Promise.all([
          metricsService.getDailyTotals(date),
          metricsService.getDailyMetrics(userId, date)
        ]);
        
        const userTotal = totals.find(total => total.user_id === userId) || null;
        setDailyTotal(userTotal);
        
        const transformedMetrics = transformMetricsToHealthMetrics(
          metricScores,
          userTotal,
          userId,
          date
        );
        setHealthMetrics(transformedMetrics);
        setFetchError(null);
      } catch (err) {
        console.error('Error fetching metrics:', err);
        setFetchError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
        setErrorDialogVisible(true);
      }
    };
    
    fetchData();
  }, [userId, date]);

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

  const handleRefresh = React.useCallback(() => {
    syncHealthData();
  }, [syncHealthData]);

  if (loading) {
    return <LoadingView />;
  }

  if (error || healthPermissionStatus === 'denied' || fetchError) {
    return (
      <View style={styles.container}>
      <Text>Unable to access health data. Please check your permissions.</Text>
      </View>
    );
    return <ErrorView error={error || fetchError || new Error('Unknown error')} onRetry={handleRetry} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: paperTheme.colors.background }]}>
      {dailyTotal && (
        <Surface style={styles.headerContainer} elevation={2}>
          <Animated.View style={[styles.headerContent, { opacity: headerOpacity }]}>
            <Image 
              source={require('@/assets/images/mylera-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Surface style={[styles.pointsContainer, { backgroundColor: paperTheme.colors.primaryContainer }]} elevation={1}>
              <Text variant="labelLarge" style={{ color: paperTheme.colors.onPrimaryContainer }}>
                Total Points
              </Text>
              <Text variant="headlineSmall" style={[styles.pointsValue, { color: paperTheme.colors.primary }]}>
                {dailyTotal.total_points}
              </Text>
            </Surface>
          </Animated.View>
        </Surface>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            colors={[paperTheme.colors.primary]}
            progressBackgroundColor={paperTheme.colors.surface}
          />
        }
      >
        {healthMetrics && (
          <MetricCardList 
            metrics={healthMetrics} 
            showAlerts={showAlerts} 
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  logo: {
    height: 32,
    width: 120,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pointsValue: {
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    textAlign: 'center',
  }
});
