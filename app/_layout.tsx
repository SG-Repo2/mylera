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
  useWindowDimensions,
  Animated
} from 'react-native';
import { AuthProvider, useAuth } from '@/src/providers/AuthProvider';
import { PaperProvider } from 'react-native-paper';
import { theme } from '../src/theme/theme';
import { isProtectedRoute, isAuthRoute, isPublicRoute, NavigationConfig } from '@/src/utils/NavigationUtils';

// Get status bar height for proper spacing
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 20 : StatusBar.currentHeight || 0;

function LoadingView() {
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

function ProtectedRoutes() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { height, width } = useWindowDimensions();
  
  // Track navigation state to prevent loops
  const navigationRef = useRef({
    isRedirecting: false,
    lastPathname: '',
    lastAuthState: { loading: true, hasSession: false },
    preventRedirectUntil: 0 // Add timestamp to prevent redirects for a period
  });
  
  // Add animation for smooth transitions
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Initialize the fade-in effect when component mounts
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);
  
  // Create a debounced navigation function with critical path handling
  const navigateSafely = useCallback((path: string) => {
    const now = Date.now();
    const nav = navigationRef.current;
    
    // Identify critical navigation paths
    const isCriticalNavigation = 
      (path === '/(app)/(home)' && pathname.includes('register')) || // Post-registration
      (path === '/(auth)/login' && !session) || // Logout to login
      (path.includes('health-setup')); // Health setup flow
    
    // Don't throttle critical navigation paths
    if (now < nav.preventRedirectUntil && !isCriticalNavigation) {
      console.log('[ProtectedRoutes] Navigation throttled, skipping redirect to', path);
      return;
    }
    
    if (nav.isRedirecting && !isCriticalNavigation) {
      console.log('[ProtectedRoutes] Navigation already in progress, skipping redirect to', path);
      return;
    }
    
    // Update ref before navigation to prevent loops
    nav.isRedirecting = true;
    nav.lastPathname = path;
    
    // Set different throttle times based on navigation importance
    nav.preventRedirectUntil = isCriticalNavigation ? 
      now + 500 : // shorter throttle for critical paths 
      now + 2000; // normal throttle time
    
    console.log('[ProtectedRoutes] Navigating to:', path, { isCriticalNavigation });
    
    // Start with zero opacity for smooth transition
    fadeAnim.setValue(0);
    
    const handleNavigation = async () => {
      try {
        await router.replace(path);
        
        // Fade in the new screen
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: isCriticalNavigation ? 100 : 200, // Faster animation for critical paths
          useNativeDriver: true,
        }).start();
        
        console.log('[ProtectedRoutes] Navigation completed to:', path);
      } catch (err) {
        console.error('[ProtectedRoutes] Navigation error:', err);
      } finally {
        // Always reset navigation flags after a delay
        setTimeout(() => {
          if (navigationRef.current) {
            navigationRef.current.isRedirecting = false;
          }
        }, isCriticalNavigation ? 100 : NavigationConfig.DEBOUNCE_DELAY);
      }
    };
    
    // Execute navigation with a small delay to let UI update
    setTimeout(() => {
      handleNavigation();
    }, 50);
  }, [router, fadeAnim, pathname, session]);
  
  // Improved navigation logic with better state tracking
  useEffect(() => {
    const nav = navigationRef.current;
    const hasSession = !!session;
    const now = Date.now();
    
    // Skip during loading, active redirects, or during throttle period
    if (loading || nav.isRedirecting || now < nav.preventRedirectUntil) {
      console.log('[ProtectedRoutes] Skip navigation check:', {
        loading,
        isRedirecting: nav.isRedirecting,
        throttled: now < nav.preventRedirectUntil
      });
      return;
    }
    
    // Check if auth state or path has changed
    const authChanged = nav.lastAuthState.loading !== loading || 
                        nav.lastAuthState.hasSession !== hasSession;
    const pathChanged = nav.lastPathname !== pathname;
    
    // Update state tracking
    nav.lastAuthState = { loading, hasSession };
    
    console.log('[ProtectedRoutes] Navigation check:', {
      authChanged,
      pathChanged,
      hasSession,
      pathname
    });

    // Special case for registration flow - if we're in a registration flow, let it complete
    if (pathname.includes('register') && hasSession) {
      console.log('[ProtectedRoutes] Registration flow in progress, allowing it to complete');
      return;
    }

    if (!hasSession) {
      if (pathname === '/' || isProtectedRoute(pathname)) {
        console.log('[ProtectedRoutes] No session on protected/root route, redirecting to login');
        navigateSafely('/(auth)/login');
      }
    } else {
      if (pathname === '/' || isAuthRoute(pathname)) {
        console.log('[ProtectedRoutes] Session exists on auth route, redirecting to home');
        navigateSafely('/(app)/(home)');
      }
    }
  }, [loading, session, pathname, navigateSafely]);

  if (loading) {
    return <LoadingView />;
  }

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <Slot />
    </Animated.View>
  );
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
