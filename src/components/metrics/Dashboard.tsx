import React, { useCallback, useMemo } from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useHealthData } from '../../hooks/useHealthData';
import { ErrorView } from '../shared/ErrorView';
import { MetricCard } from './MetricCard';
import healthMetrics from '../../config/healthMetrics';
import type { HealthProvider } from '../../providers/health/types/provider';
import type { MetricType } from '../../types/metrics';

interface DashboardProps {
  provider: HealthProvider;
  userId: string;
  date: string;
}

export function Dashboard({ provider, userId, date }: DashboardProps) {
  const {
    metrics,
    loading,
    error,
    syncHealthData
  } = useHealthData(provider, userId, date, { autoSync: true });

  // Handle loading state
  if (loading && !metrics) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  // Handle error state
  if (error) {
    return (
      <ErrorView
        message={error.message}
        onRetry={useCallback(() => syncHealthData(true), [syncHealthData])}
      />
    );
  }

  // Memoize metric value calculation
  const getMetricValue = useCallback((type: MetricType): number => {
    if (!metrics) return 0;
    return metrics[type] || 0;
  }, [metrics]);

  // Memoize refresh handler
  const handleRefresh = useCallback(() => {
    syncHealthData(true);
  }, [syncHealthData]);

  // Memoize metric cards
  const metricCards = useMemo(() => {
    return Object.entries(healthMetrics).map(([key, config]) => {
      const type = key as MetricType;
      const value = getMetricValue(type);
      const progress = config.calculateProgress(value, config.defaultGoal);

      const handlePress = () => {
        // Handle metric card press - could open detailed view
        console.log(`Pressed ${type} metric card`);
      };

      return (
        <MetricCard
          key={type}
          title={config.title}
          value={value}
          goal={config.defaultGoal}
          unit={config.displayUnit}
          icon={config.icon}
          progress={progress}
          color={config.color}
          onPress={handlePress}
        />
      );
    });
  }, [getMetricValue]);

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={handleRefresh}
          tintColor="#0284c7"
        />
      }
    >
      <View className="flex-1 gap-4">
        {metricCards}
      </View>
    </ScrollView>
  );
}