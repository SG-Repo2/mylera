// Enhanced _layout.tsx with better navigation coordination
import React, { useEffect, useRef, useCallback, useState } from 'react';
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
import { NavigationReadyProvider, useNavigationReady } from '@/src/contexts/NavigationReadyContext';
import { navigationQueue } from '@/src/utils/NavigationUtils';

// Declare the global type with our custom property
declare global {
  var appStartTime: number;
  var navigationReady: boolean;
}

// Initialize app start time for timeout calculations
global.appStartTime = Date.now();
global.navigationReady = false;

// Get status bar height for proper spacing
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 20 : StatusBar.currentHeight || 0;

// Add debug logs
console.log('[_layout.tsx] Initializing RootLayout component');

function LoadingView() {
  return (
    <SafeAreaView 
      style={[
        styles.loaderContainer, 
        { paddingTop: STATUSBAR_HEIGHT }
      ]}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </SafeAreaView>
  );
}

function ProtectedRoutes() {
  const { 
    session, 
    loading, 
    needsHealthSetup,
    healthDataInitialized // Use the new health data initialization state
  } = useAuth();
  
  const router = useRouter();
  const pathname = usePathname();
  const navigatorMounted = useNavigationReady();
  
  // Debug log when component mounts
  useEffect(() => {
    console.log('[ProtectedRoutes] Component mounted, navigatorMounted=', navigatorMounted);
  }, []);
  
  // Track navigation state to prevent loops
  const navigationRef = useRef<{
    isRedirecting: boolean;
    lastPathname: string | null;
    lastAuthState: { 
      loading: boolean; 
      hasSession: boolean;
      healthDataReady: boolean; // Add health data readiness to state tracking
    };
    navigationAttempts: number;
    lastNavigationTime: number;
    pendingNavigationTimeout: ReturnType<typeof setTimeout> | null;
    lastAuthStateChangeTime: number;
  }>({
    isRedirecting: false,
    lastPathname: null,
    lastAuthState: { 
      loading: true, 
      hasSession: false,
      healthDataReady: false
    },
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
  const navigateSafely = useCallback((path: string, priority = 0) => {
    // Skip navigation if already at this path
    if (navigationRef.current.lastPathname === path) {
      console.log('[ProtectedRoutes] Already at path, ignoring navigation to', path);
      return;
    }
    
    // Track and limit retries
    const MAX_RETRIES = 5;
    
    // Debug log with navigator mounted state
    console.log(`[ProtectedRoutes] Navigation attempt to ${path}, navigatorMounted=${navigatorMounted}`);
    
    // Force navigation after 5 seconds regardless of navigator state
    // This prevents app from getting stuck if the navigator mount detection fails
    const timeSinceAppStart = Date.now() - global.appStartTime;
    const forceNavigationAfterTimeout = timeSinceAppStart > 5000;
    
    // Wait for navigator to be mounted, unless we're forcing navigation
    if (!navigatorMounted && !forceNavigationAfterTimeout) {
      console.log('[ProtectedRoutes] Navigator not mounted, queueing navigation to', path);
      
      // Increment attempts counter
      navigationRef.current.navigationAttempts += 1;
      
      // Stop retrying after MAX_RETRIES
      if (navigationRef.current.navigationAttempts > MAX_RETRIES) {
        console.warn(`[ProtectedRoutes] Exceeded max retries (${MAX_RETRIES}) for navigation to ${path}`);
        navigationRef.current.navigationAttempts = 0;
        return;
      }
      
      // More aggressive exponential backoff for retries (base 300ms * 2^attempts)
      const delay = 300 * Math.pow(2, navigationRef.current.navigationAttempts - 1);
      setTimeout(() => navigateSafely(path, priority + 1), delay);
      return;
    }
    
    if (forceNavigationAfterTimeout && !navigatorMounted) {
      console.warn('[ProtectedRoutes] Forcing navigation despite navigator not being mounted - timeout reached');
    }
    
    // Reset navigation attempts counter when navigator is mounted
    navigationRef.current.navigationAttempts = 0;
    
    // Set global navigation ready flag
    global.navigationReady = true;
    
    // Use the navigation queue to handle the actual navigation
    navigationQueue.enqueue(path, priority);
    navigationRef.current.lastPathname = path;
  }, [navigatorMounted]);
  
  // Improved navigation logic with better state tracking and mount checking
  useEffect(() => {
    // Skip navigation attempts until a short timeout has passed
    const initialDelay = setTimeout(() => {
      const nav = navigationRef.current;
      const hasSession = !!session;
      const isHealthDataReady = !!healthDataInitialized;
      
      // Track significant auth state changes
      const isAuthStateChange = 
        nav.lastAuthState.loading !== loading || 
        nav.lastAuthState.hasSession !== hasSession ||
        nav.lastAuthState.healthDataReady !== isHealthDataReady;
      
      // Update last auth state
      nav.lastAuthState = { 
        loading, 
        hasSession,
        healthDataReady: isHealthDataReady
      };
      
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
      console.log('[ProtectedRoutes] Auth state check:', { 
        hasSession, 
        isAuthStateChange, 
        navigatorMounted,
        healthDataInitialized,
        pathname
      });

      // After login, add a small delay to ensure the session is fully loaded
      if (hasSession && isAuthStateChange && isHealthDataReady) {
        console.log('[ProtectedRoutes] Detected successful login with health data ready, preparing navigation');
        
        // Set a flag to prevent multiple navigations from the same auth state change
        const currentTime = Date.now();
        const recentAuthChange = currentTime - nav.lastAuthStateChangeTime < 5000;
        
        if (!recentAuthChange) {
          nav.lastAuthStateChangeTime = currentTime;
          
          setTimeout(() => {
            // Only navigate if not already navigating and not recently navigated
            if (!nav.isRedirecting) {
              navigateSafely('/(app)/(home)');
            }
          }, 300);
        } else {
          console.log('[ProtectedRoutes] Skipping navigation - recent auth state change');
        }
        return;
      }
      
      // Only navigate if something changed to avoid unnecessary navigation
      if (isAuthStateChange || pathname !== nav.lastPathname) {
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
          
          // Only navigate to home if health data is ready or we're not already there
          if ((pathname === '/' || isAuthRoute(pathname)) && healthDataInitialized) {
            console.log('[ProtectedRoutes] Session exists on auth route, redirecting to home with health data ready');
            navigateSafely('/(app)/(home)');
          }
        }
      }
    }, 300);
    
    return () => clearTimeout(initialDelay);
  }, [session, loading, pathname, navigateSafely, navigatorMounted, needsHealthSetup, healthDataInitialized]);

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
  // Use state for navigator mounted status with a longer initial delay
  const [navigatorMounted, setNavigatorMounted] = useState(false);
  
  // Set navigator as mounted after a delay with proper safeguards
  useEffect(() => {
    console.log('[RootLayout] Starting navigator mount timer');
    
    // Primary mount timer with increased delay
    const mountTimer = setTimeout(() => {
      setNavigatorMounted(true);
      
      // Secondary delay for navigation queue processing
      setTimeout(() => {
        navigationQueue.setNavigatorMounted(true);
        navigationQueue.processAllQueued(); // Process any queued navigations
        console.log('[RootLayout] Navigator fully mounted and ready for navigation');
      }, 500);
    }, 1200); // Increased from 800ms to 1200ms for more reliable mounting
    
    return () => clearTimeout(mountTimer);
  }, []);
  
  return (
    <AuthProvider>
      <NavigationReadyProvider value={navigatorMounted}>
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
      </NavigationReadyProvider>
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