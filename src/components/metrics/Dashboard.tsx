import React from 'react';
import { View, ScrollView, RefreshControl, SafeAreaView, StyleSheet, Image, Animated } from 'react-native';
import { Surface, Text, useTheme, ActivityIndicator, Portal, Dialog } from 'react-native-paper';
import { useHealthData } from '@/src/hooks/useHealthData';
import { ErrorView } from '@/src/components/shared/ErrorView';
import { MetricCardList } from './MetricCardList';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderPermissionError } from '@/src/providers/health/types/errors';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { metricsService } from '@/src/services/metricsService';
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
        const [totals, metricScores] = await Promise.all([
          metricsService.getDailyTotals(date),
          metricsService.getDailyMetrics(userId, date)
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
        <Surface 
          style={[
            styles.headerShadowContainer, 
            { backgroundColor: paperTheme.colors.surface }
          ]} 
          elevation={2}
        >
          <View style={styles.headerContainer}>
            <Animated.View style={[styles.headerContent, { opacity: headerOpacity }]}>
              <Image 
                source={require('@/assets/images/myLeraBanner.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Animated.View 
                style={{ 
                  transform: [{ scale: pointsScale }],
                  opacity: pointsOpacity
                }}
              >
                <Surface 
                  style={[
                    styles.pointsShadowContainer, 
                    { 
                      backgroundColor: paperTheme.colors.primaryContainer,
                      shadowColor: paperTheme.colors.primary,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 6,
                    }
                  ]} 
                  elevation={3}
                >
                  <View style={styles.pointsContainer}>
                    <Text 
                      variant="labelLarge" 
                      style={{ 
                        color: paperTheme.colors.onPrimaryContainer,
                        fontWeight: '600',
                        letterSpacing: 0.5,
                        fontSize: 16
                      }}
                    >
                      Total Points
                    </Text>
                    <Text 
                      variant="headlineMedium" 
                      style={[
                        styles.pointsValue, 
                        { 
                          color: paperTheme.colors.primary,
                          textShadowColor: 'rgba(0, 0, 0, 0.1)',
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 2
                        }
                      ]}
                    >
                      {dailyTotal.total_points}
                    </Text>
                  </View>
                </Surface>
              </Animated.View>
            </Animated.View>
          </View>
        </Surface>
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
  headerShadowContainer: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerContainer: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    height: 80,
  },
  logo: {
    height: 50,
    width: 135,
  },
  pointsShadowContainer: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  pointsValue: {
    fontWeight: '700',
    fontSize: 24,
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
