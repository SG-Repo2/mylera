import React from 'react';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
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
      <Stack.Screen name="health-setup" />
    </Stack>
  );
}