import React from 'react';
import { View, ScrollView, RefreshControl, SafeAreaView, StyleSheet, Image, Animated } from 'react-native';
import { Surface, Text, useTheme, ActivityIndicator, Portal, Dialog } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { brandColors } from '@/src/theme/theme';
import { useHealthData } from '@/src/hooks/useHealthData';
import { ErrorView } from '@/src/components/shared/ErrorView';
import { MetricCardList } from './MetricCardList';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderPermissionError } from '@/src/providers/health/types/errors';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { metricsService } from '@/src/services/metricsService';
import { leaderboardService } from '@/src/services/leaderboardService';
import { useState, useEffect } from 'react';
import type { DailyTotal } from '@/src/types/schemas';
import type { z } from 'zod';
import { DailyMetricScoreSchema, MetricType } from '@/src/types/schemas';
type DailyMetricScore = z.infer<typeof DailyMetricScoreSchema>;
import type { HealthMetrics } from '@/src/providers/health/types/metrics';

interface DashboardProps {
  provider: HealthProvider;
  userId: string;
  date?: string;
  showAlerts?: boolean;
}

const LoadingView = React.memo(() => {
  const paperTheme = useTheme();
  const pulseAnim = React.useRef(new Animated.Value(0.8)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <Surface 
      style={[
        styles.loadingShadowContainer, 
        { 
          backgroundColor: paperTheme.colors.surface,
          shadowColor: paperTheme.colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        }
      ]} 
      elevation={3}
    >
      <Animated.View 
        style={[
          styles.loadingContainer,
          { opacity: fadeAnim }
        ]}
      >
        <Animated.View 
          style={{ 
            transform: [{ scale: pulseAnim }],
            shadowColor: paperTheme.colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
          }}
        >
          <ActivityIndicator 
            size={56} 
            color={paperTheme.colors.primary} 
          />
        </Animated.View>
        <Text 
          variant="titleMedium" 
          style={[
            styles.loadingText, 
            { 
              color: paperTheme.colors.onSurfaceVariant,
              fontSize: 18,
              fontWeight: '500'
            }
          ]}
        >
          Loading your health data...
        </Text>
      </Animated.View>
    </Surface>
  );
});

const transformMetricsToHealthMetrics = (
  metrics: DailyMetricScore[],
  dailyTotal: DailyTotal | null,
  userId: string,
  date: string
): HealthMetrics => {
  const now = new Date().toISOString();
  
  // Initialize with null values as per HealthMetrics interface
  const result: HealthMetrics = {
    id: `${userId}-${date}`,
    user_id: userId,
    date: date,
    steps: null,
    distance: null,
    calories: null,
    heart_rate: null,
    exercise: null,
    basal_calories: null,
    flights_climbed: null,
    daily_score: dailyTotal?.total_points || 0,
    weekly_score: null,
    streak_days: null,
    last_updated: now,
    created_at: now,
    updated_at: now
  };

  // Map metric values from the database scores
  metrics.forEach(metric => {
    const metricType = metric.metric_type as MetricType;
    if (metricType in result && typeof metric.value === 'number') {
      // Handle distance conversion (from meters to kilometers)
      if (metricType === 'distance' && metric.value) {
        result[metricType] = metric.value / 1000; // Convert meters to kilometers
      } else {
        result[metricType] = metric.value;
      }
    }
  });

  return result;
};

export const Dashboard = React.memo(function Dashboard({
  provider,
  userId,
  date = new Date().toISOString().split('T')[0],
  showAlerts = true
}: DashboardProps) {
  const paperTheme = useTheme();
  const { healthPermissionStatus, requestHealthPermissions } = useAuth();
  const [dailyTotal, setDailyTotal] = useState<DailyTotal | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [userRank, setUserRank] = useState<number | null>(null);
  
  const {
    loading,
    error,
    syncHealthData
  } = useHealthData(provider, userId);

  const headerOpacity = React.useRef(new Animated.Value(0)).current;
  const pointsScale = React.useRef(new Animated.Value(0.9)).current;
  const pointsOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (dailyTotal) {
      Animated.sequence([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.spring(pointsScale, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(pointsOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          })
        ])
      ]).start();
    }
  }, [dailyTotal]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [totals, metricScores, rank] = await Promise.all([
          metricsService.getDailyTotals(date),
          metricsService.getDailyMetrics(userId, date),
          leaderboardService.getUserRank(userId, date)
        ]);
        
        const userTotal = totals.find(total => total.user_id === userId) || null;
        setDailyTotal(userTotal);
        
        const transformedMetrics = transformMetricsToHealthMetrics(
          metricScores,
          userTotal,
          userId,
          date
        );
        setHealthMetrics(transformedMetrics);
        setUserRank(rank);
        setFetchError(null);
      } catch (err) {
        console.error('Error fetching metrics:', err);
        setFetchError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
        setErrorDialogVisible(true);
      }
    };
    
    fetchData();
  }, [userId, date]);

  const handleRetry = React.useCallback(async () => {
    if (error instanceof HealthProviderPermissionError) {
      const status = await requestHealthPermissions();
      if (status === 'granted') {
        syncHealthData();
      }
    } else {
      syncHealthData();
    }
    setErrorDialogVisible(false);
  }, [error, requestHealthPermissions, syncHealthData]);

  const handleRefresh = React.useCallback(() => {
    syncHealthData();
  }, [syncHealthData]);

  if (loading) {
    return <LoadingView />;
  }

  if (error || healthPermissionStatus === 'denied' || fetchError) {
    return <ErrorView error={error || fetchError || new Error('Unknown error')} onRetry={handleRetry} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: paperTheme.colors.background }]}>
      {dailyTotal && (
        <>
          <View style={styles.headerContainer}>
            <Animated.View 
              style={[
                styles.headerContent,
                {
                  opacity: headerOpacity,
                  backgroundColor: 'transparent',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }
              ]}
            >
              <Image 
                source={require('@/assets/images/myLeraBanner.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text 
                variant="titleLarge"
                style={[
                  styles.headerRank,
                  { color: paperTheme.colors.primary }
                ]}
              >
                #{userRank || '-'}
              </Text>
              <Text 
                variant="titleLarge"
                style={[
                  styles.headerPoints,
                  { color: paperTheme.colors.primary }
                ]}
              >
                {dailyTotal.total_points} pts
              </Text>
            </Animated.View>
          </View>

          <Animated.View 
            style={[
              styles.statsSection,
              {
                transform: [{ scale: pointsScale }],
                opacity: pointsOpacity,
              }
            ]}
          >
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Surface 
                style={[
                  styles.statsCard, 
                  { 
                    backgroundColor: brandColors.primary,
                  }
                ]}
                elevation={2}
              >
                <View style={styles.statsContainer}>
                  <Text variant="titleMedium" style={[styles.statsLabel, { color: 'white' }]}>
                    Daily Goals
                  </Text>
                  <Text variant="headlineMedium" style={[styles.statsValue, { color: 'white' }]}>
                    {dailyTotal.metrics_completed}/7
                  </Text>
                </View>
              </Surface>

              <Surface 
                style={[
                  styles.statsCard, 
                  { 
                    backgroundColor: brandColors.success
                  }
                ]}
                elevation={2}
              >
                <View style={styles.statsContainer}>
                  <Text variant="titleMedium" style={[styles.statsLabel, { color: 'white' }]}>
                    Strength
                  </Text>
                  <MaterialCommunityIcons name="fire" size={28} color="white" />
                </View>
              </Surface>

              <Surface 
                style={[
                  styles.statsCard, 
                  { 
                    backgroundColor: paperTheme.colors.error
                  }
                ]}
                elevation={2}
              >
                <View style={styles.statsContainer}>
                  <Text variant="titleMedium" style={[styles.statsLabel, { color: 'white' }]}>
                    Improve
                  </Text>
                  <MaterialCommunityIcons name="run" size={28} color="white" />
                </View>
              </Surface>
            </View>
          </Animated.View>
        </>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            colors={[paperTheme.colors.primary]}
            progressBackgroundColor={paperTheme.colors.surface}
          />
        }
      >
        {healthMetrics && (
          <MetricCardList 
            metrics={healthMetrics} 
            showAlerts={showAlerts} 
          />
        )}
      </ScrollView>

      <Portal>
        <Dialog 
          visible={errorDialogVisible} 
          onDismiss={() => setErrorDialogVisible(false)}
          style={{
            borderRadius: 24,
            backgroundColor: paperTheme.colors.surface,
          }}
        >
          <Dialog.Title 
            style={{ 
              textAlign: 'center',
              color: paperTheme.colors.error,
              fontSize: 20,
              fontWeight: '600',
              letterSpacing: 0.5,
            }}
          >
            Error
          </Dialog.Title>
          <Dialog.Content>
            <Text 
              style={{ 
                textAlign: 'center',
                color: paperTheme.colors.onSurface,
                fontSize: 16,
                lineHeight: 24,
                letterSpacing: 0.25,
              }}
            >
              Failed to fetch health metrics. Please try again.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: 'center', paddingBottom: 8 }}>
            <Text 
              onPress={() => setErrorDialogVisible(false)} 
              style={{ 
                color: paperTheme.colors.primary,
                padding: 12,
                fontSize: 16,
                fontWeight: '600',
                letterSpacing: 0.5,
              }}
            >
              OK
            </Text>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingShadowContainer: {
    flex: 1,
    borderRadius: 20,
    margin: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'transparent',
  },
  headerContainer: {
    paddingVertical: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerContent: {
    paddingHorizontal: 16,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    height: 36,
    width: 100,
    marginRight: 'auto',
  },
  headerRank: {
    fontWeight: '700',
    letterSpacing: 0.5,
    marginHorizontal: 12,
    fontSize: 18,
  },
  headerPoints: {
    fontWeight: '700',
    letterSpacing: 0.5,
    fontSize: 18,
  },
  statsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    flex: 1,
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 80,
  },
  statsLabel: {
    fontSize: 15,
    marginBottom: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  loadingText: {
    marginTop: 20,
    textAlign: 'center',
    letterSpacing: 0.25,
  }
});
