import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
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

export default function MetricDetailScreen() {
  const { metric } = useLocalSearchParams<{ metric: MetricType }>();
  const router = useRouter();
  const { user, healthPermissionStatus } = useAuth();
  const provider = React.useMemo(() => HealthProviderFactory.getProvider(), []);
  const metricGoals = React.useMemo(() => metricsService.getMetricGoals(), []);

  // Validate metric parameter early
  if (!metric) {
    router.replace('/(app)/(home)');
    return null;
  }

  const isValidMetric = metric in healthMetrics;

  const { metrics, loading, error, syncHealthData } = useHealthData(
    provider,
    user?.id || '',
    new Date().toISOString().split('T')[0],
    { autoSync: true }
  );

  // Handle routing conditions
  if (!user) {
    router.replace('/(auth)/login');
    return null;
  }

  if (healthPermissionStatus !== 'granted') {
    return (
      <PermissionErrorView
        onRetry={() => router.replace('/(onboarding)/health-setup')}
      />
    );
  }

  if (!isValidMetric) {
    router.replace('/(app)/(home)');
    return null;
  }

  // After this point, metric is guaranteed to be valid
  const metricKey = metric as MetricType; // Safe assertion since we validated above
  const config = healthMetrics[metricKey];
  const currentValue = metrics && typeof metrics[metricKey] === 'number'
    ? metrics[metricKey] as number
    : 0;
  const goal = typeof metricGoals[metricKey]?.defaultGoal === 'number'
    ? metricGoals[metricKey].defaultGoal
    : 0;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{config.title}</Text>
      </View>

      <MetricDetailCard
        metricType={metricKey}
        value={currentValue}
        goal={goal}
        color={config.color}
      />

      <MetricChart
        type={metric as MetricType}
        data={metrics ? [metrics] : []}
        timeframe="daily"
      />

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Error loading metrics: {error.message}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  errorContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
});