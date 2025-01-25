import React from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { Redirect } from 'expo-router';

export default function AuthLayout() {
  const { session } = useAuth();

  // If user is authenticated, redirect to metrics
  if (session) {
    return <Redirect href="../(app)/metrics" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}