import React from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator, SafeAreaView, StyleSheet, Image } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { useHealthData } from '@/src/hooks/useHealthData';
import { ErrorView } from '@/src/components/shared/ErrorView';
import { PermissionErrorView } from '@/src/components/shared/PermissionErrorView';
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
  return (
    <View style={[styles.loadingContainer, { backgroundColor: paperTheme.colors.surface }]}>
      <ActivityIndicator size="large" color={paperTheme.colors.primary} />
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
  type MetricType = 'steps' | 'distance' | 'calories' | 'exercise' | 'standing' | 'heart_rate' | 'sleep';

  // Create base health metrics object
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
  
  const {
    loading,
    error,
    syncHealthData
  } = useHealthData(provider, userId);

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
  }, [error, requestHealthPermissions, syncHealthData]);

  const handleRefresh = React.useCallback(() => {
    syncHealthData();
  }, [syncHealthData]);

  if (loading) {
    return <LoadingView />;
  }

  if (error || healthPermissionStatus === 'denied' || fetchError) {
    if (error instanceof HealthProviderPermissionError || healthPermissionStatus === 'denied') {
      return <PermissionErrorView onRetry={handleRetry} />;
    }
    return <ErrorView error={error || fetchError || new Error('Unknown error')} onRetry={handleRetry} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: paperTheme.colors.neutral }]}>
      {dailyTotal && (
        <View style={styles.headerContainer}>
          <Image 
            source={require('@/assets/images/mylera-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.pointsContainer}>
            <Text variant="labelLarge" style={{ color: paperTheme.colors.onSurfaceVariant }}>
              Total Points
            </Text>
            <Text variant="headlineSmall" style={styles.pointsValue}>
              {dailyTotal.total_points}
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        style={[styles.scrollView]}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(24, 62, 159, 0.08)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#183E9F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  logo: {
    height: 32,
    width: 120,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(24, 62, 159, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pointsValue: {
    fontWeight: '700',
    fontSize: 20,
    color: '#183E9F',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F5E8C7',
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5E8C7',
  }
});
