import React, { useEffect, useState } from 'react';
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
  const [isNavigating, setIsNavigating] = useState(false);
  const [lastNavigation, setLastNavigation] = useState<string | null>(null);

  useEffect(() => {
    console.log('[ProtectedRoutes] Navigation check triggered:', {
      loading,
      hasSession: !!session,
      pathname,
      isNavigating
    });

    if (!loading && !isNavigating) {
      const targetRoute = !session ? '/(auth)/login' : '/(app)/(home)';
      const shouldNavigate = (
        (!session && (pathname === '/' || pathname.startsWith('/(app)'))) ||
        (session && (pathname === '/' || pathname.startsWith('/(auth)')))
      );

      console.log('[ProtectedRoutes] Should Navigate:', shouldNavigate, {
        targetRoute,
        lastNavigation,
      });

      if (shouldNavigate && lastNavigation !== targetRoute) {
        console.log('[ProtectedRoutes] Navigating to:', targetRoute);
        setLastNavigation(targetRoute);
        setIsNavigating(true);
        router.replace(targetRoute);
      }
    }
  }, [loading, session, router, pathname, lastNavigation]);

  // Reset navigation state when pathname changes
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

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
