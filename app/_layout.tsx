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
  const { height, width } = useWindowDimensions(); // Use for dynamic dimensions

  useEffect(() => {
    console.log('[ProtectedRoutes] Navigation check triggered:', {
      loading,
      hasSession: !!session,
      pathname
    });

    if (!loading) {
      if (!session) {
        if (pathname === '/' || pathname.startsWith('/(app)')) {
          console.log('[ProtectedRoutes] No session on protected/root route, redirecting to login');
          router.replace('/(auth)/login');
        } else {
          console.log('[ProtectedRoutes] No session on unprotected route, allowing access');
        }
      } else {
        if (pathname === '/' || pathname.startsWith('/(auth)') || pathname.startsWith('/(onboarding)')) {
          console.log('[ProtectedRoutes] Session exists on auth/root route, redirecting to home');
          router.replace('/(app)/(home)');
        } else {
          console.log('[ProtectedRoutes] Session exists on app route, allowing access');
        }
      }
    } else {
      console.log('[ProtectedRoutes] Still loading, skipping navigation check');
    }
  }, [loading, session, router, pathname]);

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
