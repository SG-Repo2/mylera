import React from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Surface, useTheme } from 'react-native-paper';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderFactory } from '@/src/providers/health';
import { useHealthData } from '@/src/hooks/useHealthData';
import { PermissionErrorView } from '@/src/components/shared/PermissionErrorView';
import { MetricChart } from '@/src/components/metrics/MetricChart';
import { MetricDetailCard } from '@/src/components/metrics/MetricCard';
import { MetricType } from '@/src/types/metrics';
import { healthMetrics } from '@/src/config/healthMetrics';

export default function MetricDetailScreen() {
  const { metric } = useLocalSearchParams<{ metric: MetricType }>();
  const router = useRouter();
  const { user, healthPermissionStatus } = useAuth();
  const theme = useTheme();
  const provider = React.useMemo(() => HealthProviderFactory.getProvider(), []);

  // Validate metric parameter early
  if (!metric || !(metric in healthMetrics)) {
    router.replace('/(app)/(home)');
    return null;
  }

  const { loading, error } = useHealthData(provider, user?.id || '');
  const [metrics, setMetrics] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const healthData = await provider.getMetrics();
        setMetrics(healthData);
      } catch (err) {
        console.error('Error fetching metrics:', err);
      }
    };
    fetchMetrics();
  }, [provider]);

  // Handle error states
  if (error || healthPermissionStatus !== 'granted') {
    return (
      <PermissionErrorView
        onRetry={() => router.replace('/(onboarding)/health-setup')}
      />
    );
  }

  const config = healthMetrics[metric];
  const currentValue = metrics[metric] || 0;

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={styles.header} elevation={2}>
        <MetricDetailCard
          metricType={metric}
          value={currentValue}
          goal={config.defaultGoal}
          color={config.color}
        />
      </Surface>

      <Surface style={styles.chartContainer} elevation={1}>
        <MetricChart
          type={metric}
          data={[{
            steps: metrics.steps || 0,
            distance: metrics.distance || 0,
            calories: metrics.calories || 0,
            exercise: metrics.exercise || 0,
            heart_rate: metrics.heart_rate || 0,
            sleep: metrics.sleep || 0,  
            id: '',
            user_id: user?.id || '',
            date: new Date().toISOString().split('T')[0],
            daily_score: 0,
            weekly_score: null,
            streak_days: null,
            last_updated: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]}
          timeframe="daily"
        />
      </Surface>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    marginBottom: 16,
  },
  chartContainer: {
    padding: 16,
    margin: 16,
    borderRadius: 12,
  }
});
