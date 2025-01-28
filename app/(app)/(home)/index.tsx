// app/(app)/(home)/index.tsx
import React, { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderFactory } from '@/src/providers/health';
import { supabase } from '@/src/services/supabaseClient';
import { HealthMetrics } from '@/src/providers/health/types';
import { MetricCard } from '@/src/components/metrics/MetricCard';
import { ErrorView } from '@/src/components/shared/ErrorView';

export default function MetricsDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch and sync health data
  const syncHealthData = async () => {
    try {
      // Get health data from device
      const healthProvider = HealthProviderFactory.getProvider();
      const deviceMetrics = await healthProvider.getMetrics();

      if (!user?.id) return;

      // Sync with Supabase
      const { error: dbError } = await supabase
        .from('daily_totals')
        .upsert({
          user_id: user.id,
          date: deviceMetrics.date,
          steps: deviceMetrics.steps,
          distance: deviceMetrics.distance,
          calories: deviceMetrics.calories,
          heart_rate: deviceMetrics.heart_rate,
          daily_score: deviceMetrics.daily_score,
        }, {
          onConflict: 'user_id,date'
        });

      if (dbError) throw dbError;
      setMetrics(deviceMetrics);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync health data');
    }
  };

  // Initial load
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setLoading(true);
        await syncHealthData();
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, [user?.id]);

  // Pull to refresh handler
  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await syncHealthData();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return <ErrorView message={error} onRetry={syncHealthData} />;
  }

  if (!metrics) {
    return <ErrorView message="No health data available" onRetry={syncHealthData} />;
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4 space-y-4">
        {/* Steps Card */}
        <MetricCard
          title="Steps"
          value={metrics.steps ?? 0}
          goal={10000}
          unit="steps"
          icon="footprints"
          progress={(metrics.steps ?? 0) / 10000}
          color="primary"
        />

        {/* Heart Rate Card */}
        <MetricCard
          title="Heart Rate"
          value={metrics.heart_rate ?? 0}
          goal={140}
          unit="bpm"
          icon="heart"
          progress={(metrics.heart_rate ?? 0) / 140}
          color="red"
          showAlert={metrics.heart_rate ? metrics.heart_rate > 140 : false}
        />

        {/* Distance Card */}
        <MetricCard
          title="Distance"
          value={metrics.distance ?? 0}
          goal={5}
          unit="km"
          icon="map"
          progress={(metrics.distance ?? 0) / 5}
          color="blue"
        />

        {/* Calories Card */}
        <MetricCard
          title="Calories"
          value={metrics.calories ?? 0}
          goal={2000}
          unit="kcal"
          icon="flame"
          progress={(metrics.calories ?? 0) / 2000}
          color="orange"
        />
      </View>
    </ScrollView>
  );
}