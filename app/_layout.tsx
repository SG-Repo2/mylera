import React, { useEffect, useRef, useCallback } from 'react';
import { useRouter, Slot, usePathname } from 'expo-router';
import { 
  ActivityIndicator, 
  View, 
  StyleSheet, 
  SafeAreaView,
  Platform,
  StatusBar,
  Dimensions,
  useWindowDimensions
} from 'react-native';
import { AuthProvider, useAuth } from '@/src/providers/AuthProvider';
import { PaperProvider } from 'react-native-paper';
import { theme } from '../src/theme/theme';

// Get status bar height for proper spacing
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 20 : StatusBar.currentHeight || 0;

function ProtectedRoutes() {
  const { session, loading, healthInitState } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  // Add health initialization to loading check
  const isLoading = loading || healthInitState.isInitializing;

  useEffect(() => {
    if (isLoading || !pathname) return;

    const routeType = {
      isAuthRoute: pathname.startsWith('/(auth)'),
      isOnboardingRoute: pathname.startsWith('/(onboarding)'),
      isAppRoute: pathname.startsWith('/(app)'),
      isRootRoute: pathname === '/'
    };

    console.log('[ProtectedRoutes] Route check:', {
      pathname,
      hasSession: !!session,
      healthState: healthInitState,
      ...routeType
    });

    // Wait for health initialization before routing
    if (!session && (routeType.isAppRoute || routeType.isRootRoute)) {
      router.replace('/(auth)/register');
      return;
    }

    if (session && (routeType.isAuthRoute || routeType.isRootRoute)) {
      router.replace('/(app)/(home)');
    }
  }, [session, isLoading, pathname, healthInitState]);

  if (isLoading) {
    return (  
      <SafeAreaView 
        style={[
          styles.loaderContainer, 
          { backgroundColor: theme.colors.background }
        ]}
      >
        <ActivityIndicator 
          size={Platform.OS === 'ios' ? 'large' : 48} 
          color={theme.colors.primary} 
        />
      </SafeAreaView>
    );

  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PaperProvider theme={theme}>
        <StatusBar
          barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
          backgroundColor={theme.colors.background}
        />
        <SafeAreaView 
          style={[
            styles.container, 
            { 
              backgroundColor: theme.colors.background,
              paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT : 0
            }
          ]}
        >
          <ProtectedRoutes />
        </SafeAreaView>
      </PaperProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Platform-specific shadow handling
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // Add padding to avoid notch/status bar
    paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT : 0,
  },
});
