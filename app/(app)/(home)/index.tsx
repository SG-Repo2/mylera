import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { debounce } from 'lodash';

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
  
  // Refs for tracking initialization and cleanup
  const initializationIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cleanupInProgressRef = useRef<boolean>(false);
  const componentMountedRef = useRef<boolean>(true);

  // Create debounced initialization function
  const debouncedInit = useCallback(
    debounce(async (signal?: AbortSignal) => {
      if (!user || !componentMountedRef.current || signal?.aborted) return;

      const currentInitId = ++initializationIdRef.current;

      try {
        setIsInitializing(prev => {
          // Only set to true if we weren't already initializing
          if (!prev) console.log('[HomeScreen] Starting initialization:', currentInitId);
          return true;
        });

        // Cleanup existing provider
        await HealthProviderFactory.cleanup();

        // Check if operation was aborted during cleanup
        if (signal?.aborted) {
          console.log('[HomeScreen] Initialization aborted after cleanup:', currentInitId);
          return;
        }

        const deviceType = user.user_metadata?.deviceType as 'os' | 'fitbit' | undefined;
        const newProvider = await HealthProviderFactory.getProvider(deviceType, user.id);

        // Check if operation was aborted during provider creation
        if (signal?.aborted) {
          console.log('[HomeScreen] Initialization aborted after provider creation:', currentInitId);
          await newProvider.cleanup().catch(error => {
            console.error('[HomeScreen] Error cleaning up aborted provider:', error);
          });
          return;
        }

        if (componentMountedRef.current) {
          setProvider(prev => {
            if (prev) {
              console.log('[HomeScreen] Replacing existing provider:', currentInitId);
            }
            return newProvider;
          });
          setProviderError(null);
        } else {
          // Component unmounted during initialization, clean up the provider
          console.log('[HomeScreen] Component unmounted during initialization, cleaning up:', currentInitId);
          await newProvider.cleanup().catch(error => {
            console.error('[HomeScreen] Error cleaning up provider after unmount:', error);
          });
        }

      } catch (error) {
        console.error('[HomeScreen] Provider initialization failed:', currentInitId, error);
        if (componentMountedRef.current && !signal?.aborted) {
          setProvider(null);
          setProviderError(error instanceof Error ? error : new Error('Failed to initialize health provider'));
        }
      } finally {
        if (componentMountedRef.current && !signal?.aborted) {
          setIsInitializing(false);
          console.log('[HomeScreen] Initialization complete:', currentInitId);
        }
      }
    }, 1000),
    [user]
  );

  // Initialize provider when user or device type changes
  useEffect(() => {
    if (!user?.user_metadata?.deviceType) return;
    
    console.log('[HomeScreen] Setting up provider for user:', user.id, 'with device type:', user.user_metadata.deviceType);
    
    // Create new abort controller
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    // Start initialization
    debouncedInit(signal);
    
    // Cleanup function
    return () => {
      console.log('[HomeScreen] Effect cleanup triggered, aborting initialization');
      debouncedInit.cancel();
      
      if (abortControllerRef.current) {
        console.log('[HomeScreen] Aborting pending initialization');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Track provider cleanup
      let providerCleanupCompleted = false;
      
      if (provider && !cleanupInProgressRef.current) {
        cleanupInProgressRef.current = true;
        console.log('[HomeScreen] Cleaning up provider on effect cleanup');
        HealthProviderFactory.cleanup()
          .then(() => {
            if (!componentMountedRef.current) return; // Component already unmounted, don't update state
            providerCleanupCompleted = true;
            console.log('[HomeScreen] Provider cleanup completed successfully');
          })
          .catch(error => {
            console.error('[HomeScreen] Error during provider cleanup:', error);
          })
          .finally(() => {
            cleanupInProgressRef.current = false;
          });
      }
      
      console.log('[HomeScreen] Effect cleanup complete');
    };
  }, [user, user?.user_metadata?.deviceType, debouncedInit, provider]);
  
  // Comprehensive cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[HomeScreen] Component unmounting, cleaning up all resources');
      componentMountedRef.current = false;
      
      // Cancel all pending operations
      debouncedInit.cancel();
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Final cleanup attempt for the provider factory
      if (!cleanupInProgressRef.current) {
        cleanupInProgressRef.current = true;
        HealthProviderFactory.cleanup()
          .then(() => console.log('[HomeScreen] Final provider cleanup successful'))
          .catch(error => console.error('[HomeScreen] Error during final provider cleanup:', error))
          .finally(() => {
            cleanupInProgressRef.current = false;
          });
      }
    };
  }, [debouncedInit]);

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
          
          // Create new abort controller for retry
          abortControllerRef.current?.abort();
          abortControllerRef.current = new AbortController();
          
          await debouncedInit(abortControllerRef.current.signal);
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
