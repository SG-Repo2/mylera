import React, { useEffect, useState } from 'react';
import { View, SafeAreaView, ScrollView, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { metricsService, MetricType } from '../../src/services/metricsService';
import { MetricCard } from '../../src/features/metrics/components/MetricCard';

interface MetricData {
  type: MetricType;
  value: number;
  goal: number;
  points: number;
  title: string;
  unit: string;
}

export default function MetricsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    if (!session?.user) return;

    try {
      setLoading(true);
      setError(null);
      const today = new Date().toISOString().split('T')[0];
      const data = await metricsService.getDailyMetrics(session.user.id, today);
      const goals = metricsService.getMetricGoals();

      // Transform the data for display
      const metricsData: MetricData[] = [
        {
          type: 'steps',
          value: data.find(m => m.metric_type === 'steps')?.value || 0,
          goal: goals.steps,
          points: data.find(m => m.metric_type === 'steps')?.points || 0,
          title: 'Daily Steps',
          unit: 'steps'
        },
        {
          type: 'distance',
          value: data.find(m => m.metric_type === 'distance')?.value || 0,
          goal: goals.distance,
          points: data.find(m => m.metric_type === 'distance')?.points || 0,
          title: 'Distance',
          unit: 'km'
        },
        {
          type: 'calories',
          value: data.find(m => m.metric_type === 'calories')?.value || 0,
          goal: goals.calories,
          points: data.find(m => m.metric_type === 'calories')?.points || 0,
          title: 'Calories Burned',
          unit: 'cal'
        }
      ];

      setMetrics(metricsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleMetricUpdate = async (type: MetricType, value: number) => {
    if (!session?.user) return;

    try {
      const goals = metricsService.getMetricGoals();
      await metricsService.updateMetric(session.user.id, {
        type,
        value,
        goal: goals[type]
      });
      await fetchMetrics(); // Refresh metrics after update
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update metric');
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [session?.user]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#20B2AA" />
          <Text className="text-text-secondary mt-2">Loading metrics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-status-error text-lg mb-2">Something went wrong</Text>
          <Text className="text-text-secondary text-center mb-4">{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text className="text-2xl font-bold text-text-primary mb-4">
            Your Metrics
          </Text>
          
          <View className="space-y-4">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.type}
                title={metric.title}
                value={metric.value}
                goal={metric.goal}
                points={metric.points}
                unit={metric.unit}
                onPress={() => handleMetricUpdate(metric.type, metric.value + 100)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}