import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text, Dimensions } from 'react-native';
import { useAuth } from '@/src/providers/auth';
import { HealthProviderFactory } from '@/src/providers/health';
import { Dashboard } from '@/src/components/metrics/Dashboard';
import { theme } from '@/src/theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface } from 'react-native-paper';
import { Animated } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const LoadingScreen = React.memo(({ message }: { message?: string }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <Animated.View 
      style={[
        styles.loadingContainer,
        { 
          paddingTop: insets.top,
          paddingBottom: insets.bottom
        }
      ]}
    >
      <Surface 
        style={[
          styles.loadingCard,
          {
            width: Math.min(SCREEN_WIDTH * 0.85, 320),
            padding: Math.max(20, Math.min(24, SCREEN_WIDTH * 0.05))
          }
        ]} 
        elevation={3}
      >
        <ActivityIndicator 
          size={Platform.OS === 'ios' ? 'large' : Math.max(36, Math.min(48, SCREEN_WIDTH * 0.1))} 
          color={theme.colors.primary} 
        />
        {message && (
          <Text 
            style={[
              styles.loadingText,
              {
                fontSize: Math.max(14, Math.min(16, SCREEN_WIDTH * 0.035)),
                marginTop: Math.max(12, Math.min(16, SCREEN_WIDTH * 0.03))
              }
            ]}
          >
            {message}
          </Text>
        )}
      </Surface>
    </Animated.View>
  );
});

export default function HomeScreen() {
  const { user, loading } = useAuth();
  const provider = useMemo(() => {
    try {
      return HealthProviderFactory.getProvider();
    } catch (error) {
      console.log('[HomeScreen] Using cached provider instance');
      return null;
    }
  }, []);
  const insets = useSafeAreaInsets();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return null;
  }

  if (!provider) {
    return <LoadingScreen message="Initializing health provider..." />;
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        {
          backgroundColor: theme.colors.background,
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
          paddingBottom: insets.bottom
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
    borderRadius: Math.max(20, Math.min(24, SCREEN_WIDTH * 0.05)),
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
  loadingText: {
    fontWeight: '600',
    color: theme.colors.primary,
    textAlign: 'center',
  },
});
