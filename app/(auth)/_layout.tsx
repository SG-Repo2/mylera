/**
 * This layout simply wraps the login and register screens in a stack.
 * We hide the header and let each screen manage its own UI. You can further customize or add a header if desired:
 */
import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
