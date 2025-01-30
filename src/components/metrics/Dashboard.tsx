import React from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
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
import type { DailyTotal, DailyMetricScore } from '@/src/types/schemas';
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
    daily_score: dailyTotal?.total_points || 0,
    weekly_score: 0,
    streak_days: 0,
    last_updated: now,
    created_at: now,
    updated_at: now
  };

  // Populate values from metrics
  metrics.forEach(metric => {
    if (metric.metric_type in result) {
      result[metric.metric_type] = metric.value;
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
    <SafeAreaView style={[styles.container, { backgroundColor: paperTheme.colors.tertiary }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            colors={[paperTheme.colors.primary]}
          />
        }
      >
        {dailyTotal && (
          <Card style={[styles.totalPointsCard, { backgroundColor: paperTheme.colors.surface }]}>
            <Card.Content>
              <View style={styles.totalPointsHeader}>
                <Text variant="titleLarge" style={[styles.totalPointsTitle, { color: paperTheme.colors.onSurface }]}>
                  Total Points
                </Text>
                <Text variant="headlineMedium" style={[styles.totalPointsValue, { color: paperTheme.colors.primary }]}>
                  {dailyTotal.total_points}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}
        
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  totalPointsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
    borderRadius: 8,
  },
  totalPointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalPointsTitle: {
    fontWeight: '500',
  },
  totalPointsValue: {
    fontWeight: 'bold',
  },
});
