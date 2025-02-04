// app/_layout.tsx
import React, { useEffect } from 'react';
import { useRouter, Slot, usePathname } from 'expo-router';
import { ActivityIndicator, View, StyleSheet, SafeAreaView } from 'react-native';
import { AuthProvider, useAuth } from '@/src/providers/AuthProvider';
import { PaperProvider } from 'react-native-paper';
import { theme } from '../src/theme/theme';

function ProtectedRoutes() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log('[ProtectedRoutes] Navigation check triggered:', {
      loading,
      hasSession: !!session,
      pathname
    });

    if (!loading) {
      if (!session) {
        // No session - redirect to login from root or protected routes
        if (pathname === '/' || pathname.startsWith('/(app)')) {
          console.log('[ProtectedRoutes] No session on protected/root route, redirecting to login');
          router.replace('/(auth)/login');
        } else {
          console.log('[ProtectedRoutes] No session on unprotected route, allowing access');
        }
      } else {
        // Has session - redirect to home from auth routes or root
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
      <SafeAreaView style={[styles.loaderContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  // Once authenticated, we just render child layouts
  return <Slot />;
}

export default function RootLayout() {
  return (
  
      <AuthProvider>
        <PaperProvider theme={theme}>
          <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ProtectedRoutes />
          </SafeAreaView>
        </PaperProvider>
      </AuthProvider>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
