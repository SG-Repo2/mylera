import React from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { useHealthData } from '@/src/hooks/useHealthData';
import { ErrorView } from '@/src/components/shared/ErrorView';
import { PermissionErrorView } from '@/src/components/shared/PermissionErrorView';
import { MetricCardList } from './MetricCardList';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderPermissionError } from '@/src/providers/health/types/errors';
import type { HealthProvider } from '@/src/providers/health/types/provider';

interface DashboardProps {
  provider: HealthProvider;
  userId: string;
  date?: string;
  showAlerts?: boolean;
}

const LoadingView = React.memo(() => {
  const theme = useTheme();
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
});

export const Dashboard = React.memo(function Dashboard({
  provider,
  userId,
  date = new Date().toISOString().split('T')[0],
  showAlerts = true
}: DashboardProps) {
  const theme = useTheme();
  const { healthPermissionStatus, requestHealthPermissions } = useAuth();
  
  const {
    metrics,
    loading,
    error,
    syncHealthData
  } = useHealthData(provider, userId, date, { autoSync: true });

  // Memoize callbacks
  const handleRetry = React.useCallback(async () => {
    if (error instanceof HealthProviderPermissionError) {
      const status = await requestHealthPermissions();
      if (status === 'granted') {
        syncHealthData(true);
      }
    } else {
      syncHealthData(true);
    }
  }, [error, requestHealthPermissions, syncHealthData]);

  const handleRefresh = React.useCallback(() => {
    syncHealthData(true);
  }, [syncHealthData]);

  // Handle error and loading states
  if (loading && !metrics) {
    return <LoadingView />;
  }

  if (error || healthPermissionStatus === 'denied') {
    if (error instanceof HealthProviderPermissionError || healthPermissionStatus === 'denied') {
      return <PermissionErrorView onRetry={handleRetry} />;
    }
    if (error) {
      return <ErrorView error={error} onRetry={handleRetry} />;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {metrics && (
          <>
            <Card style={styles.totalPointsCard}>
              <Card.Content>
                <View style={styles.totalPointsHeader}>
                  <Text variant="titleLarge">Total Points</Text>
                  <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
                    {Math.round(metrics.daily_score || 0)}
                  </Text>
                </View>
              </Card.Content>
            </Card>
            
            <MetricCardList 
              metrics={metrics} 
              showAlerts={showAlerts} 
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.userId === nextProps.userId &&
    prevProps.date === nextProps.date &&
    prevProps.showAlerts === nextProps.showAlerts
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  totalPointsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  totalPointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
