/**
 * We want the root _layout.tsx to protect all routes outside of (auth). 
 *  This means that if a user is not logged in, we redirect them to (auth)/login. We can also display a loading indicator while checking session state.
 * 	We use router.replace(...) to avoid the user being able to go back to a protected route if they are not authenticated.
	•	This _layout.tsx is automatically applied to all routes in app/ except for those in (auth)/, which has its own _layout.tsx.
 */
// app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack, useRouter, Slot } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '@/src/providers/AuthProvider';

function ProtectedRoutes() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
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
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProtectedRoutes />
      <Slot />
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