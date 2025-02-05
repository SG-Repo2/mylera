import React from 'react';
import { View, ScrollView, RefreshControl, SafeAreaView, Image, Animated } from 'react-native';
import { Surface, Text, useTheme, ActivityIndicator, Portal, Dialog } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDashboardStyles } from '@/src/styles/useDashboardStyles';
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
  const styles = useDashboardStyles();
  const theme = useTheme();
  const pulseAnim = React.useRef(new Animated.Value(0.8)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const spinAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      // Smooth pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.spring(pulseAnim, {
            toValue: 1,
            useNativeDriver: true,
            damping: 10,
            mass: 0.8,
            stiffness: 180,
          }),
          Animated.spring(pulseAnim, {
            toValue: 0.8,
            useNativeDriver: true,
            damping: 10,
            mass: 0.8,
            stiffness: 180,
          }),
        ])
      ),
      // Simple fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      // Continuous rotation
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ),
    ]).start();
  }, [pulseAnim, fadeAnim, spinAnim]);

  return (
    <Surface 
      style={[
        styles.loadingShadowContainer, 
        { backgroundColor: theme.colors.surface }
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
            shadowColor: theme.colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
          }}
        >
          <Animated.View style={{
            transform: [{
              rotate: spinAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg']
              })
            }]
          }}>
            <ActivityIndicator 
              size={56} 
              color={theme.colors.primary} 
            />
          </Animated.View>
        </Animated.View>
        <Text 
          variant="titleMedium" 
          style={[
            styles.loadingText, 
            { 
              color: theme.colors.onSurfaceVariant,
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
      // Store the raw value - any necessary conversions will be handled by the formatters
      result[metricType] = metric.value;
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
  const styles = useDashboardStyles();
  const theme = useTheme();
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
  const slideAnim = React.useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (dailyTotal) {
      Animated.sequence([
        // Slide and fade in header
        Animated.parallel([
          Animated.timing(headerOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 12,
            mass: 0.8,
            stiffness: 180,
          }),
        ]),
        // Animate points with bounce
        Animated.parallel([
          Animated.spring(pointsScale, {
            toValue: 1,
            damping: 10,
            mass: 0.8,
            stiffness: 180,
            useNativeDriver: true,
          }),
          Animated.timing(pointsOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [dailyTotal, headerOpacity, pointsScale, pointsOpacity, slideAnim]);

  useEffect(() => {
  const fetchData = async () => {
    try {
      console.log('Dashboard fetching data for:', { userId, date });
      const [totals, metricScores, rank] = await Promise.all([
        metricsService.getDailyTotals(date),
        metricsService.getDailyMetrics(userId, date),
        leaderboardService.getUserRank(userId, date)
      ]);
      
      console.log('Daily totals:', totals);
      console.log('Metric scores:', metricScores);
      
      const userTotal = totals.find(total => total.user_id === userId) || null;
      setDailyTotal(userTotal);
      
      const transformedMetrics = transformMetricsToHealthMetrics(
        metricScores,
        userTotal,
        userId,
        date
      );
      console.log('Transformed metrics:', transformedMetrics);
      
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {dailyTotal && (
        <>
          <View style={styles.headerContainer}>
            <Animated.View 
              style={[
                styles.headerContent,
                {
                  opacity: headerOpacity,
                  transform: [{ translateY: slideAnim }],
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
                  { color: theme.colors.primary }
                ]}
              >
                #{userRank || '-'}
              </Text>
              <Text 
                variant="titleLarge"
                style={[
                  styles.headerPoints,
                  { color: theme.colors.primary }
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
              <Animated.View style={{
                flex: 1,
                transform: [{
                  translateY: pointsOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  })
                }]
              }}>
                <Surface 
                  style={[
                    styles.statsCard, 
                    { 
                      backgroundColor: theme.colors.primary,
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
              </Animated.View>

              <Animated.View style={{
                flex: 1,
                transform: [{
                  translateY: pointsOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  })
                }]
              }}>
                <Surface 
                  style={[
                    styles.statsCard, 
                    { 
                      backgroundColor: theme.colors.primary,
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
              </Animated.View>

              <Animated.View style={{
                flex: 1,
                transform: [{
                  translateY: pointsOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  })
                }]
              }}>
                <Surface 
                  style={[
                    styles.statsCard, 
                    { 
                      backgroundColor: theme.colors.error
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
              </Animated.View>
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
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
      >
        {healthMetrics && (
          <MetricCardList 
            metrics={healthMetrics} 
            showAlerts={showAlerts}
            provider={provider}
          />
        )}
      </ScrollView>

      <Portal>
        <Dialog 
          visible={errorDialogVisible} 
          onDismiss={() => setErrorDialogVisible(false)}
          style={{
            borderRadius: 24,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Dialog.Title 
            style={{ 
              textAlign: 'center',
              color: theme.colors.error,
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
                color: theme.colors.onSurface,
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
                color: theme.colors.primary,
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
