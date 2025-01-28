import React, { useCallback } from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useHealthData } from '../../hooks/useHealthData';
import { ErrorView } from '../shared/ErrorView';
import { MetricCardList } from './MetricCardList';
import type { HealthProvider } from '../../providers/health/types/provider';

interface DashboardProps {
  provider: HealthProvider;
  userId: string;
  date?: string;
  showAlerts?: boolean;
}

export function Dashboard({
  provider,
  userId,
  date = new Date().toISOString().split('T')[0],
  showAlerts = true
}: DashboardProps) {
  const {
    metrics,
    loading,
    error,
    syncHealthData
  } = useHealthData(provider, userId, date, { autoSync: true });

  // Memoize handlers at the top level
  const handleRetry = useCallback(() => syncHealthData(true), [syncHealthData]);
  const handleRefresh = useCallback(() => {
    syncHealthData(true);
  }, [syncHealthData]);

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
        onRetry={handleRetry}
      />
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={handleRefresh}
          tintColor="#0284c7"
        />
      }
    >
      {metrics && <MetricCardList metrics={metrics} showAlerts={showAlerts} />}
    </ScrollView>
  );
}