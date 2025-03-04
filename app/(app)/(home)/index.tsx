import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderFactory } from '@/src/providers/health';
import { Dashboard } from '@/src/components/metrics/Dashboard';
import { theme } from '@/src/theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface } from 'react-native-paper';
import { Animated } from 'react-native';

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
  const { user, loading: authLoading } = useAuth();
  const [providerReady, setProviderReady] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  
  // Create the provider once
  const provider = useMemo(() => {
    try {
      return HealthProviderFactory.getProvider();
    } catch (err) {
      console.error('Error creating health provider:', err);
      setInitError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }, []);
  
  // Check actual initialization status
  useEffect(() => {
    let mounted = true;
    let safetyTimeout: NodeJS.Timeout;
    
    const checkProviderStatus = async () => {
      try {
        if (!provider) {
          throw new Error('Health provider not created');
        }
        
        // If provider has initialize method, use it
        if (typeof provider.initialize === 'function') {
          await provider.initialize();
        }
        
        if (mounted) {
          setProviderReady(true);
          setInitError(null);
        }
      } catch (err) {
        console.error('Provider initialization error:', err);
        if (mounted) {
          setInitError(err instanceof Error ? err : new Error(String(err)));
          // Still set ready to prevent infinite loading
          setProviderReady(true);
        }
      }
    };
    
    // Start initialization check
    checkProviderStatus();
    
    // Safety timeout to prevent infinite loading
    safetyTimeout = setTimeout(() => {
      if (mounted && !providerReady) {
        console.log('Safety timeout triggered - resolving provider ready state');
        setProviderReady(true);
      }
    }, 5000); // 5 seconds max initialization time
    
    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [provider]);
  
  const insets = useSafeAreaInsets();
  
  // Only show loading state during auth loading, not during health data loading
  if (authLoading) {
    console.log('HomeScreen: Auth loading...');
    return <LoadingScreen />;
  }

  if (!user) {
    console.log('HomeScreen: No user found');
    return null;
  }
  
  // Wait for provider to be ready before rendering Dashboard
  if (!providerReady) {
    console.log('HomeScreen: Waiting for provider to initialize...');
    return <LoadingScreen />;
  }

  // If we have an initialization error but provider is marked ready,
  // still render the Dashboard which can handle partial functionality
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
      {provider ? (
        <Dashboard
          provider={provider} 
          userId={user.id}
          showAlerts={true}
        />
      ) : (
        <Surface style={styles.errorCard} elevation={3}>
          <Text style={styles.errorText}>
            Unable to initialize health provider. Please try again.
          </Text>
        </Surface>
      )}
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
  errorCard: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    textAlign: 'center',
    color: theme.colors.error,
    fontSize: 16,
  }
});
