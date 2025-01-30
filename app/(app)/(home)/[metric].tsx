import React from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderFactory } from '@/src/providers/health';
import { useHealthData } from '@/src/hooks/useHealthData';
import { PermissionErrorView } from '@/src/components/shared/PermissionErrorView';
import { MetricChart } from '@/src/components/metrics/MetricChart';
import { MetricDetailCard } from '@/src/components/metrics/MetricCard';
import { MetricType } from '@/src/types/metrics';
import { healthMetrics } from '@/src/config/healthMetrics';
import { metricsService } from '@/src/services/metricsService';
import { DailyMetricScoreSchema } from '@/src/types/schemas';
import type { z } from 'zod';
import { theme } from '@/src/theme/theme';

type DailyMetricScore = z.infer<typeof DailyMetricScoreSchema>;

export default function MetricDetailScreen() {
  const { metric } = useLocalSearchParams<{ metric: MetricType }>();
  const router = useRouter();
  const { user, healthPermissionStatus } = useAuth();
  const provider = React.useMemo(() => HealthProviderFactory.getProvider(), []);

  // Validate metric parameter early
  if (!metric || !(metric in healthMetrics)) {
    router.replace('/(app)/(home)');
    return null;
  }

  const { loading, error, syncHealthData } = useHealthData(
    provider,
    user?.id || ''
  );

  // Check health permissions
  if (healthPermissionStatus !== 'granted') {
    return (
      <PermissionErrorView
        onRetry={() => router.replace('/(onboarding)/health-setup')}
      />
    );
  }

  // After this point, metric is guaranteed to be valid
  const metricKey = metric as MetricType;
  const config = healthMetrics[metricKey];
  const [metrics, setMetrics] = React.useState<Record<MetricType, number> | null>(null);

  React.useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const dailyMetrics = await metricsService.getDailyMetrics(
          user?.id || '',
          new Date().toISOString().split('T')[0]
        ) as DailyMetricScoreSchema[];
        const metricsRecord = dailyMetrics.reduce((acc, metric) => ({
          ...acc,
          [metric.metric_type as keyof typeof acc]: metric.value
        }), {} as Record<MetricType, number>);
        setMetrics(metricsRecord);
      } catch (err) {
        console.error('Error fetching metrics:', err);
      }
    };
    fetchMetrics();
  }, [user?.id]);

  const currentValue = metrics?.[metricKey] ?? 0;
  const goal = healthMetrics[metricKey].defaultGoal;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <MetricDetailCard
            metricType={metricKey}
            value={currentValue}
            goal={goal}
            color={config.color}
          />
        </View>

        <View style={styles.chartContainer}>
          <MetricChart
            type={metricKey}
            data={metrics ? [{
              id: '',
              user_id: user?.id || '',
              date: new Date().toISOString().split('T')[0],
              ...metrics,
              daily_score: 0,
              weekly_score: null,
              streak_days: null,
              last_updated: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }] : []}
            timeframe="daily"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(24, 62, 159, 0.08)',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  chartContainer: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    margin: 16,
    borderRadius: 12,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  }
});