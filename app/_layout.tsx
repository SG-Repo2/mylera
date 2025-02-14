import React, { useEffect } from 'react';
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
  const { height, width } = useWindowDimensions();

  useEffect(() => {
    // Skip protection checks during initial load
    if (loading) {
      console.log('[ProtectedRoutes] Initial loading, skipping navigation check');
      return;
    }

    console.log('[ProtectedRoutes] Checking route protection:', {
      pathname,
      hasSession: !!session,
      loading
    });

    // Handle different route groups
    if (pathname.startsWith('/(auth)')) {
      // Auth routes: Only redirect if user is already authenticated
      if (session) {
        console.log('[ProtectedRoutes] Authenticated user accessing auth route, redirecting to home');
        router.replace('/(app)/(home)');
      }
    } else if (pathname.startsWith('/(app)')) {
      // App routes: Require authentication
      if (!session) {
        console.log('[ProtectedRoutes] Unauthenticated user accessing app route, redirecting to login');
        router.replace('/(auth)/login');
      }
    } else if (pathname.startsWith('/(onboarding)')) {
      // Onboarding routes: Allow only during registration flow
      console.log('[ProtectedRoutes] Onboarding route accessed');
    } else if (pathname === '/') {
      // Root route: Redirect based on auth status
      const target = session ? '/(app)/(home)' : '/(auth)/login';
      console.log(`[ProtectedRoutes] Root route accessed, redirecting to ${target}`);
      router.replace(target);
    }
  }, [session, loading, pathname]);

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
