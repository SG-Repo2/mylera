/**
 * Optimized Dashboard Component
 * 
 * This component displays health metrics data with optimizations to prevent
 * unnecessary re-renders and improve UI performance.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Animated, RefreshControl, SafeAreaView } from 'react-native';
import {Text, Surface } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HealthProvider } from '@/src/providers/health/types/provider';
import { ErrorView } from '@/src/components/shared/ErrorView';
import { logger, LogCategory } from '@/src/utils/logger';
import { theme } from '@/src/theme/theme';

// Types
import type { HealthMetrics } from '@/src/providers/health/types/metrics';
import type { DailyTotal } from '@/src/types/schemas';

// Define props for Dashboard component
interface DashboardProps {
  provider: HealthProvider;
  userId: string;
  date?: string;
  showAlerts?: boolean;
}

// Memoized Header component
const Header = React.memo(({ dailyTotal }: { dailyTotal: DailyTotal }) => {
  const operationId = useRef(`header-${Date.now()}`).current;
  
  logger.debug(
    LogCategory.Rendering,
    `Rendering Header component`,
    operationId
  );
  
  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Health Dashboard</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Points</Text>
            <Text style={styles.statText}>{dailyTotal.total_points} pts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Goals Completed</Text>
            <Text style={styles.statText}>{dailyTotal.metrics_completed}</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

// Memoized LoadingView component
const LoadingView = React.memo(() => {
  const insets = useSafeAreaInsets();
  const operationId = useRef(`loading-${Date.now()}`).current;
  
  logger.debug(
    LogCategory.Rendering,
    `Rendering LoadingView component`,
    operationId
  );
  
  // Animation setup
  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  
  useEffect(() => {
    // Create pulsing animation
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
    ).start();
    
    // Cleanup animation on unmount
    return () => {
      pulseAnim.stopAnimation();
    };
  }, [pulseAnim]);
  
  return (
    <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
      <Surface style={styles.loadingCard} elevation={3}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </Animated.View>
        <Text style={styles.loadingText}>Loading your health data...</Text>
      </Surface>
    </View>
  );
});

// Memoized MetricCard component
const MetricCard = React.memo(({ 
  title, 
  value, 
  goal, 
  unit,
  onPress
}: { 
  title: string; 
  value: number; 
  goal: number;
  unit: string;
  onPress?: () => void;
}) => {
  const operationId = useRef(`metric-${title}-${Date.now()}`).current;
  
  logger.debug(
    LogCategory.Rendering,
    `Rendering MetricCard: ${title}`,
    operationId
  );
  
  // Calculate progress percentage (memoized)
  const progress = useMemo(() => {
    const calculatedProgress = Math.min(value / goal, 1);
    logger.debug(
      LogCategory.Rendering,
      `Calculated progress for ${title}`,
      operationId,
      undefined,
      { value, goal, progress: calculatedProgress }
    );
    return calculatedProgress;
  }, [value, goal, title, operationId]);
  
  // Format value for display (memoized)
  const formattedValue = useMemo(() => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
  }, [value]);
  
  return (
    <Surface style={styles.metricCard} elevation={2}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
      <View style={styles.metricContent}>
        <Text style={styles.metricValue}>
          {formattedValue} <Text style={styles.metricUnit}>{unit}</Text>
        </Text>
        <Text style={styles.metricGoal}>Goal: {goal} {unit}</Text>
      </View>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>
    </Surface>
  );
});

// Main Dashboard component
export const Dashboard: React.FC<DashboardProps> = React.memo(({
  provider,
  userId,
  date = new Date().toISOString().split('T')[0],
  showAlerts = true
}) => {
  // Generate a stable operation ID for logging
  const operationId = useRef(`dashboard-${Date.now()}`).current;
  
  logger.debug(
    LogCategory.Lifecycle,
    `Dashboard initializing`,
    operationId,
    userId,
    { date, showAlerts }
  );
  
  // Component state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [dailyTotal, setDailyTotal] = useState<DailyTotal | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  
  // UI state
  const insets = useSafeAreaInsets();
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  
  // Refs for tracking async operations
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMounted = useRef<boolean>(true);
  
  // Handle fetch errors consistently
  const handleError = useCallback((err: unknown) => {
    if (!isMounted.current) return;
    
    const errorMessage = err instanceof Error 
      ? err.message 
      : 'An unknown error occurred';
    
    logger.error(
      LogCategory.Error,
      `Dashboard error`,
      operationId,
      userId,
      { error: err }
    );
    
    setError(new Error(errorMessage));
    setLoading(false);
    setRefreshing(false);
  }, [operationId, userId]);
  
  // Transform raw metrics data into display format
  const transformMetricsToDisplayFormat = useCallback((
    metrics: HealthMetrics | null
  ) => {
    if (!metrics) return [];
    
    return [
      {
        id: 'steps',
        title: 'Steps',
        value: metrics.steps || 0,
        goal: 10000,
        unit: 'steps'
      },
      {
        id: 'distance',
        title: 'Distance',
        value: metrics.distance || 0,
        goal: 5000,
        unit: 'm'
      },
      {
        id: 'calories',
        title: 'Calories',
        value: metrics.calories || 0,
        goal: 500,
        unit: 'kcal'
      },
      {
        id: 'heart_rate',
        title: 'Heart Rate',
        value: metrics.heart_rate || 0,
        goal: 75,
        unit: 'bpm'
      }
    ].filter(metric => metric.value > 0);
  }, []);
  
  // Memoize the metrics data to avoid unnecessary recalculations
  const displayMetrics = useMemo(() => {
    return transformMetricsToDisplayFormat(healthMetrics);
  }, [healthMetrics, transformMetricsToDisplayFormat]);
  
  // Fetch health data from provider and API
  const fetchData = useCallback(async () => {
    if (!provider || !userId) {
      logger.warn(
        LogCategory.Provider,
        `Missing provider or userId for fetchData`,
        operationId,
        userId
      );
      return;
    }
    
    try {
      logger.info(
        LogCategory.Provider,
        `Fetching health data`,
        operationId,
        userId,
        { date }
      );
      
      // Cancel any previous fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create new abort controller for this fetch
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      // Simulate fetching metrics from provider
      const metrics = await provider.getMetrics();
      
      // Check if request was aborted before updating state
      if (controller.signal.aborted || !isMounted.current) {
        logger.debug(
          LogCategory.Provider,
          `Fetch was aborted, skipping state update`,
          operationId,
          userId
        );
        return;
      }
      
      // Simulate fetching daily total from API
      const total: DailyTotal = {
        id: `${userId}-${date}`,
        user_id: userId,
        date,
        total_points: 450,
        metrics_completed: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      logger.debug(
        LogCategory.Provider,
        `Health data fetched successfully`,
        operationId,
        userId,
        { 
          metricsReceived: !!metrics,
          totalReceived: !!total
        }
      );
      
      // Update state with fetched data
      setHealthMetrics(metrics);
      setDailyTotal(total);
      setError(null);
    } catch (err) {
      handleError(err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [provider, userId, date, handleError, operationId]);
  
  // Handle refresh action
  const handleRefresh = useCallback(() => {
    logger.debug(
      LogCategory.User,
      `User triggered refresh`,
      operationId,
      userId
    );
    
    setRefreshing(true);
    fetchData();
  }, [fetchData, operationId, userId]);
  
  // Handle retry action after error
  const handleRetry = useCallback(() => {
    logger.debug(
      LogCategory.User,
      `User triggered retry after error`,
      operationId,
      userId
    );
    
    setLoading(true);
    setError(null);
    fetchData();
  }, [fetchData, operationId, userId]);
  
  // Animated header (memoized)
  const AnimatedHeader = useMemo(() => {
    if (!dailyTotal) return null;
    
    return (
      <Animated.View 
        style={[
          styles.headerWrapper,
          {
            opacity: headerOpacity,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Header dailyTotal={dailyTotal} />
      </Animated.View>
    );
  }, [dailyTotal, headerOpacity, slideAnim]);
  
  // Memoized list of metric cards
  const MetricCards = useMemo(() => {
    return displayMetrics.map((metric) => (
      <MetricCard
        key={metric.id}
        title={metric.title}
        value={metric.value}
        goal={metric.goal}
        unit={metric.unit}
      />
    ));
  }, [displayMetrics]);
  
  // Animate header when data is available
  useEffect(() => {
    if (dailyTotal) {
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
      ]).start();
    }
  }, [dailyTotal, headerOpacity, slideAnim]);
  
  // Fetch data on mount and when dependencies change
  useEffect(() => {
    logger.debug(
      LogCategory.Lifecycle,
      `Dashboard useEffect - fetchData`,
      operationId,
      userId
    );
    
    setLoading(true);
    fetchData();
    
    // Cleanup on unmount
    return () => {
      logger.debug(
        LogCategory.Lifecycle,
        `Dashboard unmounting, cleaning up`,
        operationId,
        userId
      );
      
      isMounted.current = false;
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [fetchData, operationId, userId]);
  
  // Render based on component state
  if (loading && !refreshing) {
    return <LoadingView />;
  }
  
  if (error) {
    return <ErrorView error={error} onRetry={handleRetry} />;
  }
  
  return (
    <SafeAreaView style={styles.container}>
      {AnimatedHeader}
      
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        testID="dashboard-scroll-view"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        <View style={styles.metricsContainer}>
          {MetricCards.length > 0 ? (
            MetricCards
          ) : (
            <Surface style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No health metrics available
              </Text>
            </Surface>
          )}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}, (prevProps, nextProps) => {
  // Custom equality check to prevent unnecessary re-renders
  return (
    prevProps.provider === nextProps.provider &&
    prevProps.userId === nextProps.userId &&
    prevProps.date === nextProps.date &&
    prevProps.showAlerts === nextProps.showAlerts
  );
});

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerWrapper: {
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  headerContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    marginLeft: 16,
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'right',
  },
  statText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  metricsContainer: {
    gap: 16,
  },
  metricCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  metricContent: {
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  metricUnit: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#666666',
  },
  metricGoal: {
    fontSize: 14,
    color: '#666666',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    width: '80%',
    maxWidth: 300,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    minHeight: 200,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
});

export default Dashboard;