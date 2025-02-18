import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderFactory } from '@/src/providers/health';
import { Dashboard } from '@/src/components/metrics/Dashboard';
import { theme } from '@/src/theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface } from 'react-native-paper';
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
      </Surface>
    </Animated.View>
  );
});

export default function HomeScreen() {
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const [provider, setProvider] = useState<HealthProvider | null>(null);
  const [providerError, setProviderError] = useState<Error | null>(null);

  const initProvider = async () => {
    if (!user) return;

    try {
      console.log('[HomeScreen] Initializing health provider...');
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
    }
  };

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

  // Initialize provider when user or device type changes
  useEffect(() => {
    if (user?.user_metadata?.deviceType) {
      initProvider();
    }
  }, [user, user?.user_metadata?.deviceType]);

  if (loading || (!provider && !providerError)) {
    return <LoadingScreen />;
  }

  if (!user) {
    return null;
  }

  if (providerError) {
    return (
      <ErrorView 
        error={providerError} 
        onRetry={() => {
          setProviderError(null);
          setProvider(null);
        }}
      />
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
        provider={provider!}
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
});
