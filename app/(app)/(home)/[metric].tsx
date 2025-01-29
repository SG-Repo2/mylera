import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderFactory } from '@/src/providers/health';
import { useHealthData } from '@/src/hooks/useHealthData';
import { PermissionErrorView } from '@/src/components/shared/PermissionErrorView';
import { MetricChart } from '@/src/components/metrics/MetricChart';
import { MetricType } from '@/src/types/metrics';
import { metricsService } from '@/src/services/metricsService';
import type { HealthMetrics } from '@/src/providers/health/types/metrics';

const METRIC_ICONS = {
  steps: 'walk',
  distance: 'map-marker-distance',
  calories: 'fire',
  heart_rate: 'heart-pulse',
  exercise: 'run',
  standing: 'human-handsup'
} as const;

const METRIC_TITLES = {
  steps: 'Daily Steps',
  distance: 'Distance',
  calories: 'Active Calories',
  heart_rate: 'Heart Rate',
  exercise: 'Exercise Minutes',
  standing: 'Standing Hours'
} as const;

export default function MetricDetailScreen() {
  const { metric } = useLocalSearchParams<{ metric: MetricType }>();
  const router = useRouter();
  const { user, healthPermissionStatus } = useAuth();
  const provider = HealthProviderFactory.getProvider();

  const { metrics, loading, error, syncHealthData } = useHealthData(
    provider,
    user?.id || '',
    new Date().toISOString().split('T')[0],
    { autoSync: true }
  );

  const metricGoals = useMemo(() => metricsService.getMetricGoals(), []);
  
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

  if (!metric || !Object.keys(METRIC_TITLES).includes(metric)) {
    router.replace('/(app)/(home)');
    return null;
  }

  const title = METRIC_TITLES[metric];
  const icon = METRIC_ICONS[metric];
  const goal = metricGoals[metric].defaultGoal;
  const unit = metricGoals[metric].unit;
  const currentValue = metrics?.[metric] || 0;
  const progress = goal ? Math.min(currentValue / goal, 1) : 0;
  const progressPercentage = Math.round(progress * 100);

  // Mock historical data for the chart
  const mockHistoricalData = useMemo(() => {
    const data: HealthMetrics[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const date = new Date(now);
      date.setHours(date.getHours() - i);
      const baseValue = Math.random() * currentValue * 1.5;
      
      data.push({
        id: `${i}`,
        user_id: user.id,
        date: date.toISOString(),
        steps: metric === 'steps' ? baseValue : null,
        distance: metric === 'distance' ? baseValue : null,
        calories: metric === 'calories' ? baseValue : null,
        heart_rate: metric === 'heart_rate' ? baseValue : null,
        exercise: metric === 'exercise' ? baseValue : null,
        standing: metric === 'standing' ? baseValue : null,
        daily_score: Math.round(Math.random() * 100),
        weekly_score: Math.round(Math.random() * 700),
        streak_days: Math.round(Math.random() * 7),
        last_updated: date.toISOString(),
        created_at: date.toISOString(),
        updated_at: date.toISOString()
      });
    }
    return data;
  }, [user.id, metric, currentValue]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name={icon}
          size={32}
          color="#4B9EFF"
        />
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Current</Text>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>
            {Math.round(currentValue).toLocaleString()}
          </Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>

        <View style={styles.goalContainer}>
          <Text style={styles.label}>Goal Progress</Text>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${progressPercentage}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {progressPercentage}% of daily goal ({goal} {unit})
          </Text>
        </View>
      </View>

      {/* Metric Chart */}
      <MetricChart
        type={metric}
        data={mockHistoricalData}
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
    color: '#111827',
  },
  card: {
    margin: 16,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  value: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#111827',
  },
  unit: {
    fontSize: 20,
    color: '#6B7280',
    marginLeft: 8,
  },
  goalContainer: {
    marginTop: 16,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4B9EFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
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