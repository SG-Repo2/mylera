// src/components/metrics/Dashboard.tsx
import React, { useCallback } from 'react';
import { View, ScrollView, RefreshControl, Text } from 'react-native';
import { useHealthData } from '../../hooks/useHealthData';
import { ErrorView } from '../shared/ErrorView';
import { PermissionErrorView } from '../shared/PermissionErrorView';
import { MetricCardList } from './MetricCardList';
import { useAuth } from '../../providers/AuthProvider';
import type { HealthProvider } from '../../providers/health/types/provider';
import { HealthProviderPermissionError } from '../../providers/health/types/errors';

interface DashboardProps {
  provider: HealthProvider;
  userId: string;
  date?: string;
}

export function Dashboard({
  provider,
  userId,
  date = new Date().toISOString().split('T')[0],
}: DashboardProps) {
  const { user } = useAuth();
  const {
    metrics,
    loading,
    error,
    syncHealthData
  } = useHealthData(provider, userId, date, { autoSync: true });

  const handleRetry = useCallback(async () => {
    if (error instanceof HealthProviderPermissionError) {
      const status = await requestHealthPermissions();
      if (status === 'granted') {
        syncHealthData(true);
      }
    } else {
      syncHealthData(true);
    }
  }, [syncHealthData, error, requestHealthPermissions]);

  if (loading && !metrics) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" className="text-primary" />
      </View>
    );
  }

  if (error) {
    if (error instanceof HealthProviderPermissionError) {
      return <PermissionErrorView onRetry={handleRetry} />;
    }
    return <ErrorView message={error.message} onRetry={handleRetry} />;
  }

  const totalPoints = metrics ? Object.values(metrics)
    .filter(metric => typeof metric === 'number')
    .reduce((sum, points) => sum + (points || 0), 0) : 0;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => syncHealthData(true)}
          tintColor="#10B981"
        />
      }
    >
      <View className="p-4">
        <Text className="text-2xl font-primary text-gray-800">
          Good {getTimeOfDay()}, {user?.email?.split('@')[0]}
        </Text>
        <Text className="text-3xl font-bold font-primary text-gray-900 mt-1">
          Your Dashboard
        </Text>
      </View>

      {metrics && (
        <MetricCardList 
          metrics={metrics} 
          totalPoints={totalPoints}
        />
      )}
    </ScrollView>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}