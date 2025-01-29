// app/_layout.tsx
import React, { useEffect } from 'react';
import { useRouter, Slot, usePathname } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
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
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Once authenticated, we just render child layouts
  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PaperProvider theme={theme}>
        <ProtectedRoutes />
      </PaperProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});