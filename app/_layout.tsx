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
import { HealthProvider } from '@/src/providers/HealthProvider';
import { PaperProvider } from 'react-native-paper';
import { theme } from '../src/theme/theme';
import { isProtectedRoute, isAuthRoute, NavigationConfig } from '@/src/utils/NavigationUtils';
import { NavigationReadyProvider, useNavigationReady } from '@/src/contexts/NavigationReadyContext';
import { navigationQueue } from '@/src/utils/NavigationUtils';
import { useAuthNavigation } from '@/src/hooks/useAuthNavigation';

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
    healthDataInitialized,
    healthPermissionStatus // Add this
  } = useAuth();
  
  const pathname = usePathname();
  const { isReady: navigatorMounted } = useNavigationReady(); // Update this
  const { navigateSafely } = useAuthNavigation();
  
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

  // Add permission handling here where we have access to AuthProvider
  useEffect(() => {
    if (healthPermissionStatus !== null) {
      // Update parent's permission state
      navigationQueue.setPermissionsHandled(true);
    }
  }, [healthPermissionStatus]);

  if (loading) {
    return <LoadingView />;
  }

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <Slot />
    </Animated.View>
  );
}

// Add HealthProviderWrapper component to integrate HealthProvider with Auth state
function HealthProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  return (
    <HealthProvider userId={user?.id || null}>
      {children}
    </HealthProvider>
  );
}

export default function RootLayout() {
  const [navigatorMounted, setNavigatorMounted] = useState(false);
  
  // Remove usePermissionCheck and handle permissions through NavigationQueue
  useEffect(() => {
    console.log('[RootLayout] Starting navigator mount timer');
    
    const mountTimer = setTimeout(() => {
      setNavigatorMounted(true);
      
      setTimeout(() => {
        navigationQueue.setNavigatorMounted(true);
        navigationQueue.processAllQueued();
        console.log('[RootLayout] Navigator fully mounted and ready for navigation');
      }, 500);
    }, 1200);
    
    return () => clearTimeout(mountTimer);
  }, []);

  return (
    <AuthProvider>
      <NavigationReadyProvider 
        value={navigatorMounted}
        permissionsHandled={navigationQueue.isPermissionsHandled()}
      >
        <HealthProviderWrapper>
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
        </HealthProviderWrapper>
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