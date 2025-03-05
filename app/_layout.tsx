// Modified _layout.tsx root component with navigation guard
import React, { useEffect, useRef, useCallback } from 'react';
import { useRouter, Slot, usePathname } from 'expo-router';
import { 
  ActivityIndicator, 
  View, 
  StyleSheet, 
  SafeAreaView,
  Platform,
  StatusBar,
  Animated
} from 'react-native';
import { AuthProvider, useAuth } from '@/src/providers/AuthProvider';
import { PaperProvider } from 'react-native-paper';
import { theme } from '../src/theme/theme';
import { isProtectedRoute, isAuthRoute, NavigationConfig } from '@/src/utils/NavigationUtils';

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

function ProtectedRoutes({ isNavigatorMounted }: { isNavigatorMounted: React.MutableRefObject<boolean> }) {
  const { session, loading, needsHealthSetup } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  // Track navigation state to prevent loops
  const navigationRef = useRef<{
    isRedirecting: boolean;
    lastPathname: string | null;
    lastAuthState: { loading: boolean; hasSession: boolean };
    navigationAttempts: number;
    lastNavigationTime: number;
    pendingNavigationTimeout: ReturnType<typeof setTimeout> | null;
    lastAuthStateChangeTime: number;
  }>({
    isRedirecting: false,
    lastPathname: null,
    lastAuthState: { loading: true, hasSession: false },
    navigationAttempts: 0,
    lastNavigationTime: 0,
    pendingNavigationTimeout: null,
    lastAuthStateChangeTime: 0
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
  
  // Create a debounced navigation function with navigator mount check
  const navigateSafely = (path: string) => {
    // Clean up any pending navigation timeouts first
    if (navigationRef.current.pendingNavigationTimeout) {
      clearTimeout(navigationRef.current.pendingNavigationTimeout);
      navigationRef.current.pendingNavigationTimeout = null;
    }

    // Prevent navigation during active navigation
    if (navigationRef.current.isRedirecting) {
      console.log('[ProtectedRoutes] Navigation already in progress, ignoring call to', path);
      return;
    }

    // Check if we're already on this path to prevent unnecessary navigation
    if (navigationRef.current.lastPathname === path) {
      console.log('[ProtectedRoutes] Already at path, ignoring navigation to', path);
      return;
    }

    if (!isNavigatorMounted.current) {
      console.log('[ProtectedRoutes] Navigator not yet mounted, delaying navigation to', path);
      navigationRef.current.navigationAttempts++;
      
      // Prevent infinite retry loops
      if (navigationRef.current.navigationAttempts > 5) {
        console.warn('[ProtectedRoutes] Too many navigation attempts, forcing navigation');
      } else {
        // Retry after a delay
        setTimeout(() => navigateSafely(path), 500);
        return;
      }
    }
    
    // Add throttling to prevent multiple navigations within a short period
    const now = Date.now();
    if (now - navigationRef.current.lastNavigationTime < NavigationConfig.DEBOUNCE_DELAY) {
      console.log('[ProtectedRoutes] Navigation throttled, too soon after previous navigation');
      
      // Instead of recursively calling navigateSafely, use a cleaner approach
      const timeoutId = setTimeout(() => {
        // Check again if we're already navigating when the timeout fires
        if (!navigationRef.current.isRedirecting) {
          navigateSafely(path);
        }
      }, NavigationConfig.DEBOUNCE_DELAY);
      
      // Store the timeout ID to potentially cancel it
      navigationRef.current.pendingNavigationTimeout = timeoutId;
      return;
    }
    
    // Update ref before navigation to prevent loops
    navigationRef.current.isRedirecting = true;
    navigationRef.current.lastPathname = path;
    navigationRef.current.navigationAttempts = 0;
    navigationRef.current.lastNavigationTime = now;
    
    console.log('[ProtectedRoutes] Navigating to:', path);
    
    // Start with zero opacity for smooth transition
    fadeAnim.setValue(0);
    
    const handleNavigation = async () => {
      try {
        await router.replace(path);
        // Fade in the new screen
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.error('[ProtectedRoutes] Navigation error:', error);
      } finally {
        // Allow future navigations after a delay to debounce
        setTimeout(() => {
          navigationRef.current.isRedirecting = false;
        }, NavigationConfig.DEBOUNCE_DELAY);
      }
    };
    
    handleNavigation();
  };
  
  // Improved navigation logic with better state tracking and mount checking
  useEffect(() => {
    // Skip navigation attempts until a short timeout has passed
    const initialDelay = setTimeout(() => {
      const nav = navigationRef.current;
      const hasSession = !!session;
      
      // Track significant auth state changes
      const isAuthStateChange = 
        nav.lastAuthState.loading !== loading || 
        nav.lastAuthState.hasSession !== hasSession;
      
      // Update last auth state
      nav.lastAuthState = { loading, hasSession };
      
      // Add a navigation throttle - don't navigate if we just did recently
      const now = Date.now();
      const timeSinceLastNav = now - nav.lastNavigationTime;
      if (timeSinceLastNav < 2000) { // 2 seconds minimum between navigations
        console.log('[ProtectedRoutes] Throttling navigation - too frequent');
        return;
      }
      
      // Skip during loading or active redirects
      if (loading || nav.isRedirecting) {
        console.log('[ProtectedRoutes] Skip navigation check:', {
          loading,
          isRedirecting: nav.isRedirecting
        });
        return;
      }
      
      // Extra logging for debug
      console.log('[ProtectedRoutes] Auth state check:', { hasSession, isAuthStateChange });

      // After login, add a small delay to ensure the session is fully loaded
      // This helps prevent the Dashboard loading twice
      if (hasSession && isAuthStateChange) {
        console.log('[ProtectedRoutes] Detected successful login, preparing navigation');
        
        // Set a flag to prevent multiple navigations from the same auth state change
        const currentTime = Date.now();
        const recentAuthChange = currentTime - nav.lastAuthStateChangeTime < 5000;
        
        if (!recentAuthChange) {
          nav.lastAuthStateChangeTime = currentTime;
          
          setTimeout(() => {
            // Only navigate if not already navigating and not recently navigated
            if (!nav.isRedirecting) {
              navigateSafely('/');
            }
          }, 150);
        } else {
          console.log('[ProtectedRoutes] Skipping navigation - recent auth state change');
        }
        return;
      }
      
      // Check if auth state or path has changed
      const authChanged = nav.lastAuthState.loading !== loading || 
                          nav.lastAuthState.hasSession !== hasSession;
      const pathChanged = nav.lastPathname !== pathname;
      
      console.log('[ProtectedRoutes] Navigation check:', {
        authChanged,
        pathChanged,
        hasSession,
        pathname,
        navigatorMounted: isNavigatorMounted.current,
        needsHealthSetup: needsHealthSetup?.()
      });
  
      // Only navigate if something changed to avoid unnecessary navigation
      if (authChanged || pathChanged) {
        if (!hasSession) {
          if (pathname === '/' || isProtectedRoute(pathname)) {
            console.log('[ProtectedRoutes] No session on protected/root route, redirecting to login');
            navigateSafely('/(auth)/login');
          }
        } else {
          // Check if user needs health setup - important after removing the Health-Setup screen
          if (needsHealthSetup?.()) {
            // If this path is already requesting permissions, don't redirect again
            const isRequestingPermissions = pathname.includes('/(app)');
            if (!isRequestingPermissions) {
              console.log('[ProtectedRoutes] User needs health setup, navigating to home for permission prompt');
              navigateSafely('/(app)/(home)');
              return;
            }
          }
          
          if (pathname === '/' || isAuthRoute(pathname)) {
            console.log('[ProtectedRoutes] Session exists on auth route, redirecting to home');
            navigateSafely('/(app)/(home)');
          }
        }
      }
    }, 100);
    
    return () => clearTimeout(initialDelay);
  }, [session, loading, router, pathname, navigateSafely, isNavigatorMounted, needsHealthSetup]);

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
  // Track when the navigator is fully mounted
  const isNavigatorMounted = useRef(false);
  
  // Set navigator as mounted after a delay
  useEffect(() => {
    const mountTimer = setTimeout(() => {
      isNavigatorMounted.current = true;
      console.log('[RootLayout] Navigator marked as mounted');
    }, 300);
    
    return () => clearTimeout(mountTimer);
  }, []);
  
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
          <ProtectedRoutes isNavigatorMounted={isNavigatorMounted} />
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