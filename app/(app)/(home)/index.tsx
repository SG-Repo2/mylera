// app/(app)/(home)/index.tsx
import React from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderFactory } from '@/src/providers/health';
import { useHealthData } from '@/src/hooks/useHealthData';
import { MetricCard } from '@/src/components/metrics/MetricCard';
import { ErrorView } from '@/src/components/shared/ErrorView';
import healthMetrics from '@/src/config/healthMetrics';
import type { MetricType } from '@/src/types/metrics';

export default function MetricsDashboard() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const provider = HealthProviderFactory.getProvider();

  const {
    metrics,
    loading,
    error,
    syncHealthData
  } = useHealthData(provider, user?.id || '', today);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  if (error) {
    return (
      <ErrorView 
        message={error.message} 
        onRetry={() => syncHealthData(true)} 
      />
    );
  }

  if (!metrics) {
    return (
      <ErrorView 
        message="No health data available" 
        onRetry={() => syncHealthData(true)} 
      />
    );
  }

  // Calculate metrics for display
  const getMetricValue = (type: MetricType): number => {
    return metrics[type] || 0;
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl 
          refreshing={loading} 
          onRefresh={() => syncHealthData(true)}
          tintColor="#0284c7"
        />
      }
    >
      <View className="p-4 space-y-4">
        {Object.entries(healthMetrics).map(([key, config]) => {
          const type = key as MetricType;
          const value = getMetricValue(type);
          const progress = config.calculateProgress(value, config.defaultGoal);
          const showAlert = type === 'heart_rate' && value > config.defaultGoal;

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
              showAlert={showAlert}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}