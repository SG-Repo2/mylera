import React, { useCallback } from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
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
  showAlerts?: boolean;
}

export function Dashboard({
  provider,
  userId,
  date = new Date().toISOString().split('T')[0],
  showAlerts = true
}: DashboardProps) {
  const { healthPermissionStatus, requestHealthPermissions } = useAuth();
  const {
    metrics,
    loading,
    error,
    syncHealthData
  } = useHealthData(provider, userId, date, { autoSync: true });

  // Memoize handlers at the top level
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

  // Handle permission denied state
  if (healthPermissionStatus === 'denied') {
    return (
      <PermissionErrorView
        onRetry={handleRetry}
      />
    );
  }

  // Handle other error states
  if (error) {
    // If it's a permission error, show the permission error view
    if (error instanceof HealthProviderPermissionError) {
      return (
        <PermissionErrorView
          onRetry={handleRetry}
        />
      );
    }
    
    // For other errors, show the generic error view
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