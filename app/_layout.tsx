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
    if (!loading) {
      if (!session) {
        // If not authenticated, redirect to (auth)/login
        router.replace('/(auth)/login');
      } else if (pathname.startsWith('/(auth)')) {
        // If authenticated and on auth routes, redirect to home
        router.replace('/(app)/(home)');
      }
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