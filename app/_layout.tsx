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
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const navigationInProgressRef = useRef(false);
  const lastNavigationRef = useRef<string | null>(null);

  // Memoize the navigation function
  const navigateToRoute = useCallback((route: string) => {
    // Prevent duplicate navigations
    if (lastNavigationRef.current === route) {
      console.log('[ProtectedRoutes] Skipping duplicate navigation to:', route);
      return;
    }

    // Prevent concurrent navigations
    if (navigationInProgressRef.current) {
      console.log('[ProtectedRoutes] Navigation already in progress, skipping');
      return;
    }

    console.log('[ProtectedRoutes] Executing navigation to:', route);
    navigationInProgressRef.current = true;
    lastNavigationRef.current = route;

    // Use setTimeout to ensure we're not blocking the main thread
    setTimeout(() => {
      router.replace(route);
      // Reset navigation flag after a delay to prevent rapid re-triggers
      setTimeout(() => {
        navigationInProgressRef.current = false;
      }, 100);
    }, 0);
  }, [router]);

  // Handle route protection
  useEffect(() => {
    // Skip if loading or no pathname
    if (loading || !pathname) {
      console.log('[ProtectedRoutes] Loading or no pathname, skipping navigation check');
      return;
    }

    // Parse route type
    const routeType = {
      isAuthRoute: pathname.startsWith('/(auth)'),
      isOnboardingRoute: pathname.startsWith('/(onboarding)'),
      isAppRoute: pathname.startsWith('/(app)'),
      isRootRoute: pathname === '/'
    };

    console.log('[ProtectedRoutes] Checking route protection:', {
      pathname,
      hasSession: !!session,
      ...routeType
    });

    // Handle unauthenticated users
    if (!session) {
      const requiresAuth = routeType.isAppRoute || routeType.isRootRoute;
      if (requiresAuth && !routeType.isAuthRoute) {
        console.log('[ProtectedRoutes] Unauthenticated user accessing protected route');
        navigateToRoute('/(auth)/register');
      }
      return;
    }

    // Handle authenticated users
    const isPublicRoute = routeType.isAuthRoute || routeType.isOnboardingRoute || routeType.isRootRoute;
    if (isPublicRoute) {
      console.log('[ProtectedRoutes] Authenticated user accessing public route');
      navigateToRoute('/(app)/(home)');
    }
  }, [session, loading, pathname, navigateToRoute]);

  // Handle loading state
  if (loading) {
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
