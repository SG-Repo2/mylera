import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        presentation: 'card',
      }}
    >
      <Stack.Screen
        name="register"
        options={{
          gestureEnabled: false, // Prevent going back from register since it's initial
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          animation: 'fade',
        }}
      />
    </Stack>
  );
}
