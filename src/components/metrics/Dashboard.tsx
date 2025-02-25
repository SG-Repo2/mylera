import React from 'react';
import { View, ScrollView, RefreshControl, SafeAreaView, Image, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, Text, useTheme, ActivityIndicator, Portal, Dialog } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDashboardStyles } from '@/src/styles/useDashboardStyles';
import { useHealthData } from '@/src/hooks/useHealthData';
import { ErrorView } from '@/src/components/shared/ErrorView';
import { MetricCardList } from './MetricCardList';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderPermissionError } from '@/src/providers/health/types/errors';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { leaderboardService } from '@/src/services/leaderboardService';
import { unifiedMetricsService } from '@/src/services/unifiedMetricsService';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { DailyTotal } from '@/src/types/schemas';
import type { HealthMetrics } from '@/src/providers/health/types/metrics';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';
import { determineHealthPlatform } from '@/src/utils/healthUtils';
interface DashboardProps {
  provider: HealthProvider;
  userId: string;
  date?: string;
  showAlerts?: boolean;
}

const Header = React.memo(({ dailyTotal }: { dailyTotal: DailyTotal }) => {
  const styles = useDashboardStyles();
  const theme = useTheme();
  
  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerContent}>
        <Image
          source={require('@/assets/images/myLeraBanner.png')}
          style={styles.logo}
        />
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statText}>{dailyTotal.total_points} pts</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const LoadingView = React.memo(() => {
  const styles = useDashboardStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const pulseAnim = React.useRef(new Animated.Value(0.8)).current;
  const spinAnim = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    Animated.parallel([
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
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ),
    ]).start();
  }, []);

  return (
    <View style={[
      styles.loadingContainer,
      { paddingTop: insets.top }
    ]}>
      <View style={styles.loadingCard}>
        <Animated.View style={{
          transform: [
            { scale: pulseAnim },
            {
              rotate: spinAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg']
              })
            }
          ]
        }}>
          <ActivityIndicator
            size={Platform.OS === 'ios' ? 'large' : 48}
            color={theme.colors.primary}
          />
        </Animated.View>
        <Text style={styles.loadingText}>
          Loading your health data...
        </Text>
      </View>
    </View>
  );
});

export function Dashboard({
  provider,
  userId,
  date = new Date().toISOString().split('T')[0],
  showAlerts = true
}: DashboardProps) {
  const { healthInitState, healthPermissionStatus } = useAuth();
  const [loading, setLoading] = useState(true);
  console.log('[Dashboard] Initial render: loading state is', loading);
  
  // Simplified initialization check focusing on essential conditions
  const isFullyInitialized = useCallback(() => {
    const ready = healthPermissionStatus === 'granted' && provider?.isInitialized();
    console.log('[Dashboard] Initialization check:', {
      healthPermissionStatus,
      providerInitialized: provider?.isInitialized(),
      ready
    });
    return ready;
  }, [healthPermissionStatus, provider]);

  const styles = useDashboardStyles();
  const theme = useTheme();
  const { healthPermissionStatus: authHealthPermissionStatus, requestHealthPermissions, user } = useAuth();
  const [dailyTotal, setDailyTotal] = useState<DailyTotal | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  const refreshInProgress = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const {
    loading: healthDataLoading,
    error,
    syncHealthData,
    isInitialized
  } = useHealthData(provider, userId);





  useEffect(() => {
    console.log('[Dashboard] useEffect triggered: healthDataLoading is', healthDataLoading);
    if (!healthDataLoading) {
      setLoading(false);
    }
  });
  const headerOpacity = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-20)).current;

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

  // Enhanced fetch data with transaction handling and retry logic
  const fetchData = useCallback(async () => {
    if (!isFullyInitialized()) {
      console.log('[Dashboard] Not fully initialized, skipping fetch');
      return;
    }

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    setIsTransactionPending(true);
    try {
      console.log('[Dashboard] Fetching data for:', { userId, date });
      
      // Get metrics through unified service
      const metrics = await unifiedMetricsService.getMetrics(userId, date, provider);
      setHealthMetrics(metrics);
      
      // Get rank after metrics are synced
      const rank = await leaderboardService.getUserRank(userId, date);
      setUserRank(rank);
      
      // Set daily total based on metrics
      const userTotal = {
        id: `${userId}-${date}`,
        user_id: userId,
        date: date,
        total_points: metrics.daily_score,
        metrics_completed: Object.values(metrics).filter(v => v !== null).length - 4, // Exclude id, user_id, date, daily_score
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setDailyTotal(userTotal);
      setFetchError(null);
      
    } catch (error) {
      console.error('[Dashboard] Fetch error:', error);
      
      // Handle transaction-related errors with retry
      if (error instanceof Error && 
          (error.message.includes('transaction') || 
           error.message.includes('deadlock') || 
           error.message.includes('conflict'))) {
        console.log('[Dashboard] Transaction error detected, scheduling retry');
        retryTimeoutRef.current = setTimeout(() => {
          console.log('[Dashboard] Retrying fetch after transaction error');
          fetchData();
        }, 1000);
        return;
      }
      
      setFetchError(error instanceof Error ? error : new Error('Fetch failed'));
    } finally {
      setIsTransactionPending(false);
    }
  }, [isFullyInitialized, userId, date, provider]);

  useEffect(() => {
    fetchData();
  }, [fetchData, isInitialized, user?.user_metadata?.measurementSystem]);

  const handleRetry = React.useCallback(async () => {
    try {
      setErrorDialogVisible(false);
      
      // If it's a permission error, handle it first
      if (error instanceof HealthProviderPermissionError) {
        console.log('[Dashboard] Requesting health permissions...');
        const status = await requestHealthPermissions();
        if (status !== 'granted') {
          throw new Error('Health permissions are required to track your fitness metrics');
        }
        console.log('[Dashboard] Health permissions granted');
      }

      if (!user) {
        throw new Error('User must be logged in to retry');
      }

      // Clean up existing provider
      console.log('[Dashboard] Cleaning up existing provider...');
      const factory = HealthProviderFactory.getInstance();
      const platform = determineHealthPlatform(user);
      if (!platform) {
        throw new Error('Could not determine health platform for user');
      }
      await factory.cleanup(`${platform}:${user.id}`);
      console.log('[Dashboard] Provider cleanup complete');
      
      // Get platform and initialize new provider
      console.log('[Dashboard] Initializing new provider...');
      const provider = await factory.getProvider(platform, user.id);
      console.log('[Dashboard] New provider initialized');
      
      syncHealthData();
      console.log('[Dashboard] Health data sync triggered');
    } catch (error) {
      console.error('[Dashboard] Retry failed:', error);
      setErrorDialogVisible(true);
      setFetchError(error instanceof Error ? error : new Error('Failed to retry health data sync'));
    }
  }, [error, requestHealthPermissions, syncHealthData, user]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (refreshInProgress.current) return;
    
    refreshInProgress.current = true;
    setRefreshing(true);
    
    const abortController = new AbortController();
    const { signal } = abortController;

    try {
      // Get metrics through unified service (handles sync and DB updates)
      const metrics = await unifiedMetricsService.getMetrics(userId, date, provider, signal);
      setHealthMetrics(metrics);
      
      // Get updated rank after metrics are synced
      const rank = await leaderboardService.getUserRank(userId, date);
      setUserRank(rank);
      
      // Calculate and set daily total
      const userTotal = {
        id: `${userId}-${date}`,
        user_id: userId,
        date: date,
        total_points: metrics.daily_score,
        metrics_completed: Object.values(metrics).filter(v => v !== null).length - 4, // Exclude id, user_id, date, daily_score
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setDailyTotal(userTotal);
      
    } catch (error) {
      if (signal.aborted) {
        console.log("[Dashboard] Refresh aborted");
      } else {
        console.error("[Dashboard] Refresh error:", error);
        setErrorDialogVisible(true);
        setFetchError(error instanceof Error ? error : new Error('Refresh failed'));
      }
    } finally {
      refreshInProgress.current = false;
      setRefreshing(false);
    }

    return () => {
      abortController.abort();
    };
  }, [provider, userId, date]);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  console.log('[Dashboard] Render check: loading is', loading, 'isTransactionPending is', isTransactionPending);
  if (loading || isTransactionPending) {
    return <LoadingView />;
  }

  if (error || authHealthPermissionStatus === 'denied' || fetchError) {
    const finalError = error || fetchError || new Error('Unknown error');
    const isPermissionError = finalError instanceof HealthProviderPermissionError;
    
    return (
      <ErrorView 
        error={finalError} 
        onRetry={handleRetry}
        showPermissionButton={isPermissionError}
      />
    );
  }

  return (
    <SafeAreaView 
      style={[
        styles.container, 
        { 
          backgroundColor: theme.colors.background,
          paddingTop: Platform.OS === 'ios' ? 0 : 4
        }
      ]}
    >
      {dailyTotal && (
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
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
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
