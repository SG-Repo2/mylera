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
  const { session, loading, authTransition } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const navigationInProgressRef = useRef(false);
  const lastNavigationRef = useRef<string | null>(null);
  const isMountedRef = useRef(false);
  const initialNavigationCompleteRef = useRef(false);
  const layoutMountedRef = useRef(false);

  // Set mounted flag on initial render and handle cleanup
  useEffect(() => {
    // Delay setting mounted flag to ensure layout is ready
    const mountTimer = setTimeout(() => {
      isMountedRef.current = true;
      layoutMountedRef.current = true;
      console.log('[ProtectedRoutes] Component mounted and ready');
    }, 100);

    return () => {
      clearTimeout(mountTimer);
      isMountedRef.current = false;
      layoutMountedRef.current = false;
    };
  }, []);

  // Handle initial navigation after mount
  useEffect(() => {
    if (!isMountedRef.current || initialNavigationCompleteRef.current) return;

    // Skip if not fully mounted or during transitions
    if (!layoutMountedRef.current || loading || authTransition.isTransitioning) {
      console.log('[ProtectedRoutes] Waiting for component readiness:', {
        isLayoutMounted: layoutMountedRef.current,
        loading,
        isTransitioning: authTransition.isTransitioning
      });
      return;
    }

    // Handle initial route protection
    const routeType = {
      isAuthRoute: pathname?.startsWith('/(auth)') || false,
      isOnboardingRoute: pathname?.startsWith('/(onboarding)') || false,
      isAppRoute: pathname?.startsWith('/(app)') || false,
      isRootRoute: pathname === '/'
    };

    console.log('[ProtectedRoutes] Initial route check:', {
      pathname,
      hasSession: !!session,
      ...routeType
    });

    // Determine initial route
    let initialRoute = null;
    if (!session) {
      if (routeType.isAppRoute || routeType.isRootRoute) {
        initialRoute = '/(auth)/register';
      }
    } else if (routeType.isAuthRoute || routeType.isRootRoute) {
      initialRoute = '/(app)/(home)';
    }

    if (initialRoute) {
      console.log('[ProtectedRoutes] Setting initial route to:', initialRoute);
      // Ensure layout is mounted before navigation
      if (layoutMountedRef.current && isMountedRef.current) {
        console.log('[ProtectedRoutes] Executing initial navigation to:', initialRoute);
        // Use Promise to ensure navigation completes
        Promise.resolve().then(() => {
          router.replace(initialRoute!);
          initialNavigationCompleteRef.current = true;
        });
      } else {
        console.log('[ProtectedRoutes] Waiting for layout mount before navigation');
      }
    } else {
      initialNavigationCompleteRef.current = true;
    }
  }, [session, loading, pathname, router, authTransition]);

  // Memoize the navigation function for subsequent navigations
  const navigateToRoute = useCallback((route: string) => {
    if (!isMountedRef.current || !initialNavigationCompleteRef.current) {
      console.log('[ProtectedRoutes] Skipping navigation - not ready');
      return;
    }

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

    // Ensure layout is mounted and ready before navigation
    if (layoutMountedRef.current && isMountedRef.current) {
      Promise.resolve().then(() => {
        router.replace(route);
        // Reset navigation flag after navigation completes
        Promise.resolve().then(() => {
          navigationInProgressRef.current = false;
        });
      });
    } else {
      console.log('[ProtectedRoutes] Navigation skipped - layout not ready');
      navigationInProgressRef.current = false;
    }
  }, [router]);

  // Handle subsequent route protection
  useEffect(() => {
    if (!isMountedRef.current || !initialNavigationCompleteRef.current || !pathname || authTransition.isTransitioning) {
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
      ...routeType,
      loading
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
  }, [session, pathname, navigateToRoute, authTransition]);

  if (!isMountedRef.current || (loading && !authTransition.isTransitioning)) {
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
