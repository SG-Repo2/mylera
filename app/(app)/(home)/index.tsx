import React, { useEffect, useState } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProvider } from '@/src/providers/health/types/provider';
import { Dashboard } from '@/src/components/metrics/Dashboard';
import { theme } from '@/src/theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, Text, ActivityIndicator } from 'react-native-paper';
import { Animated, View } from 'react-native';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeProvider = async () => {
      if (!user) return;
      
      try {
        const healthProvider = await HealthProviderFactory.getProvider('os', user.id);
        setProvider(healthProvider);
      } catch (error) {
        console.error('Failed to initialize health provider:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeProvider();
  }, [user]);
  
  if (authLoading || loading) {
    return <LoadingScreen />;
  }

  if (!user || !provider) {
    return null;
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
});
