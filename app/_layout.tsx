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
    lastAuthState: { loading: true, hasSession: false }
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
  
  // Create a debounced navigation function
  const navigateSafely = useCallback((path: string) => {
    if (navigationRef.current.isRedirecting) {
      console.log('[ProtectedRoutes] Navigation already in progress, skipping redirect to', path);
      return;
    }
    
    // Update ref before navigation to prevent loops
    navigationRef.current.isRedirecting = true;
    navigationRef.current.lastPathname = path;
    
    console.log('[ProtectedRoutes] Navigating to:', path);
    
    // Start with zero opacity for smooth transition
    fadeAnim.setValue(0);
    
    const handleNavigation = async () => {
      await router.replace(path);
      // Fade in the new screen
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      // Allow future navigations after a delay to debounce
      setTimeout(() => {
        navigationRef.current.isRedirecting = false;
      }, NavigationConfig.DEBOUNCE_DELAY);
    };
    
    handleNavigation();
  }, [router, fadeAnim]);
  
  // Improved navigation logic with better state tracking
  useEffect(() => {
    const nav = navigationRef.current;
    const hasSession = !!session;
    
    // Skip during loading or active redirects
    if (loading || nav.isRedirecting) {
      console.log('[ProtectedRoutes] Skip navigation check:', {
        loading,
        isRedirecting: nav.isRedirecting
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
