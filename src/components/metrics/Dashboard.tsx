import React, { useCallback, useEffect } from 'react';
import { View, ScrollView, RefreshControl, SafeAreaView, Image, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, useTheme, ActivityIndicator, Portal, Dialog } from 'react-native-paper';
import { ErrorView } from '@/src/components/shared/ErrorView';
import { MetricCardList } from './MetricCardList';
import { useAuth } from '@/src/providers/auth';
import { HealthProviderPermissionError } from '@/src/providers/health/types/errors';
import { useDashboardStyles } from '@/src/styles/useDashboardStyles';
import { useDashboardAnimations } from '@/src/hooks/useDashboardAnimations';
import { useDashboardData } from '@/src/hooks/useDashboardData';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import type { DailyTotal } from '@/src/types/schemas';

interface DashboardProps {
  provider: HealthProvider;
  userId: string;
  date?: string;
  showAlerts?: boolean;
}

// Add TypeScript types for component props
interface HeaderProps {
  dailyTotal: DailyTotal;
}

interface ErrorDialogProps {
  visible: boolean;
  onDismiss: () => void;
  message?: string; // Add customizable error message
}

// Add prop types validation

// Add loading state customization
interface LoadingViewProps {
  message?: string;
  showSpinner?: boolean;
}

// Extracted Header component with React.memo for performance
const Header = React.memo(({ dailyTotal }: HeaderProps) => {
  const styles = useDashboardStyles();
  
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

// Extracted LoadingView component with React.memo for performance
const LoadingView = React.memo(({ 
  message = 'Loading your health data...',
  showSpinner = true 
}: LoadingViewProps) => {
  const styles = useDashboardStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { loadingAnimations } = useDashboardAnimations(null);
  
  return (
    <View style={[
      styles.loadingContainer,
      { paddingTop: insets.top }
    ]}>
      <View style={styles.loadingCard}>
        <Animated.View style={{
          transform: [
            { scale: loadingAnimations.scale },
            { rotate: loadingAnimations.rotate }
          ]
        }}>
          <ActivityIndicator
            size={Platform.OS === 'ios' ? 'large' : 48}
            color={theme.colors.primary}
          />
        </Animated.View>
        <Text style={styles.loadingText}>
          {message}
        </Text>
      </View>
    </View>
  );
});

// Extracted ErrorDialog component with React.memo for performance
const ErrorDialog = React.memo(({ 
  visible, 
  onDismiss,
  message = 'Failed to fetch health metrics. Please try again.'
}: ErrorDialogProps) => {
  const theme = useTheme();
  const styles = useDashboardStyles();
  
  return (
    <Portal>
      <Dialog 
        visible={visible} 
        onDismiss={onDismiss}
        style={styles.errorDialog}
      >
        <Dialog.Title style={styles.errorDialogTitle}>
          Error
        </Dialog.Title>
        <Dialog.Content>
          <Text style={styles.errorDialogContent}>
            {message}
          </Text>
        </Dialog.Content>
        <Dialog.Actions style={styles.errorDialogActions}>
          <Text 
            onPress={onDismiss} 
            style={styles.errorDialogButton}
          >
            OK
          </Text>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
});

// Update the error boundary implementation
class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorView
          error={this.state.error || new Error('Unknown error occurred')}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

export const Dashboard = React.memo(function Dashboard({
  provider,
  userId,
  date = new Date().toISOString().split('T')[0],
  showAlerts = true
}: DashboardProps) {
  const styles = useDashboardStyles();
  const theme = useTheme();
  const { healthPermissionStatus, requestHealthPermissions } = useAuth();
  
  // Use our custom hooks
  const {
    dailyTotal,
    healthMetrics,
    loading,
    error,
    errorDialogVisible,
    setErrorDialogVisible,
    isRefreshing,
    refreshData,
    handleRetry,
    availableMetrics,
    isDataLoaded
  } = useDashboardData(provider, userId, date);
  
  const { headerAnimations } = useDashboardAnimations(dailyTotal);
  
  // Extended retry handler that checks permissions
  const extendedRetryHandler = React.useCallback(async () => {
    if (error instanceof HealthProviderPermissionError) {
      const status = await requestHealthPermissions();
      if (status === 'granted') {
        handleRetry();
      }
    } else {
      handleRetry();
    }
  }, [error, requestHealthPermissions, handleRetry]);

  // Enhanced loading state check
  const isLoading = loading || (!healthMetrics && !error && !dailyTotal && !isDataLoaded);
  
  // Add timeout for initial load
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isLoading) {
      timeoutId = setTimeout(() => {
        // Only retry if we haven't loaded data yet
        if (!healthMetrics && !error && !isDataLoaded) {
          handleRetry();
        }
      }, 10000); // 10 second timeout
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading, healthMetrics, error, handleRetry, isDataLoaded]);

  // Add error retry with backoff
  const retryWithBackoff = useCallback(async () => {
    try {
      await refreshData();
    } catch (error) {
      console.error('Error retrying data fetch:', error);
      // Show error dialog with retry option
      setErrorDialogVisible(true);
    }
  }, [refreshData]);

  // Render loading state with enhanced check
  if (isLoading) {
    return <LoadingView 
      message={isDataLoaded ? "Refreshing your health data..." : "Loading your health data..."} 
      showSpinner={true} 
    />;
  }

  // Update error handling
  if (error) {
    return (
      <ErrorView 
        error={error}
        onRetry={retryWithBackoff}
      />
    );
  }

  // Type guard to ensure data exists
  if (!healthMetrics || !dailyTotal) {
    return <ErrorView 
      error={new Error('Failed to load health metrics')} 
      onRetry={extendedRetryHandler} 
    />;
  }

  return (
    <DashboardErrorBoundary>
      <SafeAreaView 
        style={[
          styles.container, 
          { paddingTop: Platform.OS === 'ios' ? 0 : 4 }
        ]}
      >
        {dailyTotal && (
          <Animated.View style={[styles.headerWrapper, headerAnimations]}>
            <Header dailyTotal={dailyTotal} />
          </Animated.View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refreshData}
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
              isInitialLoad={!dailyTotal}
              isManualRefresh={isRefreshing}
              availableMetrics={availableMetrics as Set<string>}
              hasMinimumMetrics={true}
            />
          )}
        </ScrollView>

        <ErrorDialog 
          visible={errorDialogVisible} 
          onDismiss={() => setErrorDialogVisible(false)} 
        />
      </SafeAreaView>
    </DashboardErrorBoundary>
  );
});