import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderFactory } from '@/src/providers/health';
import { Dashboard } from '@/src/components/metrics/Dashboard';
import { theme } from '@/src/theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, Text } from 'react-native-paper';
import { Animated } from 'react-native';
import { ErrorView } from '@/src/components/shared/ErrorView';
import type { HealthProvider } from '@/src/providers/health/types/provider';

const LoadingScreen = React.memo(() => {
  const insets = useSafeAreaInsets();
  
  return (
    <Animated.View 
      style={[
        styles.loadingContainer,
        { paddingTop: insets.top }
      ]}
    >
      <Surface style={styles.loadingCard} elevation={3}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Initializing health services...</Text>
      </Surface>
    </Animated.View>
  );
});

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [provider, setProvider] = useState<HealthProvider | null>(null);
  const [providerError, setProviderError] = useState<Error | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const initProvider = useCallback(async () => {
    if (!user) return;

    try {
      setIsInitializing(true);
      console.log('[HomeScreen] Initializing health provider...');
      
      // Clean up any existing provider first
      await HealthProviderFactory.cleanup();
      
      const deviceType = user.user_metadata?.deviceType as 'os' | 'fitbit' | undefined;
      console.log('[HomeScreen] Using device type:', deviceType);
      
      const newProvider = await HealthProviderFactory.getProvider(deviceType, user.id);
      console.log('[HomeScreen] Provider initialized successfully');
      
      setProvider(newProvider);
      setProviderError(null);
    } catch (error) {
      console.error('[HomeScreen] Failed to initialize provider:', error);
      setProviderError(error instanceof Error ? error : new Error('Failed to initialize health provider'));
      setProvider(null);
    } finally {
      setIsInitializing(false);
    }
  }, [user]);

  // Initialize provider when user or device type changes
  useEffect(() => {
    if (user?.user_metadata?.deviceType) {
      initProvider();
    }
  }, [user, user?.user_metadata?.deviceType, initProvider]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (provider) {
        console.log('[HomeScreen] Cleaning up provider on unmount');
        HealthProviderFactory.cleanup().catch(error => {
          console.error('[HomeScreen] Error during provider cleanup:', error);
        });
      }
    };
  }, [provider]);

  if (authLoading || isInitializing) {
    return <LoadingScreen />;
  }

  if (!user) {
    return null;
  }

  if (providerError) {
    return (
      <ErrorView 
        error={providerError} 
        onRetry={async () => {
          setProviderError(null);
          setProvider(null);
          await initProvider();
        }}
      />
    );
  }

  if (!provider) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Surface style={styles.errorCard}>
          <Text style={styles.errorText}>Unable to initialize health services</Text>
        </Surface>
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        {
          backgroundColor: theme.colors.background,
          paddingTop: Platform.OS === 'android' ? insets.top : 0
        }
      ]}
    >
      <Dashboard
        provider={provider}
        userId={user.id}
        showAlerts={true}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
    gap: 16,
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
    color: theme.colors.onSurfaceVariant,
    fontSize: 16,
    textAlign: 'center',
  },
  errorCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.errorContainer,
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
  },
});
