// app/_layout.tsx
import React, { useEffect } from 'react';
import { useRouter, Slot } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '@/src/providers/AuthProvider';
import { PaperProvider } from 'react-native-paper';
import { theme } from '../src/theme/theme';

function ProtectedRoutes() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      // If not authenticated, redirect to (auth)/login
      router.replace('/(auth)/login');
    }
  }, [loading, session, router]);

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