import React, { useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHealthData } from '../../hooks/useHealthData';
import { ErrorView } from '../shared/ErrorView';
import { PermissionErrorView } from '../shared/PermissionErrorView';
import { MetricCardList } from './MetricCardList';
import { useAuth } from '../../providers/AuthProvider';
import type { HealthProvider } from '../../providers/health/types/provider';
import type { HealthMetrics } from '../../providers/health/types/metrics';
import { HealthProviderPermissionError } from '../../providers/health/types/errors';

// Helper function to calculate total points based on metrics values
const calculateTotalPoints = (metrics: HealthMetrics): number => {
  const stepsValue = metrics.steps || 0;
  const heartRateValue = metrics.heart_rate || 0;
  const caloriesValue = metrics.calories || 0;
  const distanceValue = metrics.distance || 0;
  
  // Convert raw values to points
  const stepsPoints = Math.round((stepsValue / 10000) * 165); // 165 max points
  const heartRatePoints = Math.round((heartRateValue / 100) * 250); // 250 max points
  const caloriesPoints = Math.round((caloriesValue / 600) * 188); // 188 max points
  const distancePoints = Math.round((distanceValue / 5) * 160); // 160 max points
  
  return Math.min(stepsPoints + heartRatePoints + caloriesPoints + distancePoints, 1000);
};

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
  const { user, healthPermissionStatus, requestHealthPermissions } = useAuth();
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

  const handleRefresh = useCallback(() => {
    syncHealthData(true);
  }, [syncHealthData]);

  // Handle loading state
  if (loading && !metrics) {
    return (
      <View style={styles.loadingContainer}>
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
    if (error instanceof HealthProviderPermissionError) {
      return (
        <PermissionErrorView
          onRetry={handleRetry}
        />
      );
    }
    
    return (
      <ErrorView
        message={error.message}
        onRetry={handleRetry}
      />
    );
  }

  const totalPoints = metrics ? calculateTotalPoints(metrics) : 0;
  const timeOfDay = getTimeOfDay();
  const firstName = user?.email?.split('@')[0] || 'User';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor="#0284c7"
          />
        }
      >
        {/* Dashboard Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Good {timeOfDay}, {firstName}
          </Text>
          <Text style={styles.title}>
            Your Dashboard
          </Text>
        </View>

        {/* Total Points Card */}
        {metrics && (
          <View style={styles.totalPointsCard}>
            <View style={styles.totalPointsHeader}>
              <Text style={styles.totalPointsTitle}>
                Total Points
              </Text>
              <View style={styles.pointsDisplay}>
                <MaterialCommunityIcons
                  name="trending-up"
                  size={24}
                  color="#0284c7"
                />
                <Text style={styles.pointsValue}>
                  {totalPoints}
                </Text>
                <Text style={styles.pointsMax}>
                  / 1000
                </Text>
              </View>
            </View>
            
            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${Math.min((totalPoints / 1000) * 100, 100)}%` }
                ]}
              />
            </View>
          </View>
        )}

        {/* Metrics Cards */}
        {metrics && <MetricCardList metrics={metrics} showAlerts={showAlerts} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

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
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 20,
    color: '#4B5563',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  totalPointsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  totalPointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalPointsTitle: {
    fontSize: 20,
    color: '#374151',
    fontWeight: '500',
  },
  pointsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  pointsMax: {
    fontSize: 20,
    color: '#6B7280',
  },
  progressBarContainer: {
    marginTop: 16,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#0284c7',
    borderRadius: 9999,
  },
});