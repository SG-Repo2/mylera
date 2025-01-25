import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { FontAwesome } from '@expo/vector-icons';

export default function AppLayout() {
  const { session } = useAuth();

  // Protect these routes - redirect to login if not authenticated
  if (!session) {
    return <Redirect href="../auth/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#20B2AA', // primary color from ui guidelines
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarActiveTintColor: '#20B2AA',
        tabBarInactiveTintColor: '#7F8C8D',
      }}
    >
      <Tabs.Screen
        name="metrics"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Metrics',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarLabel: 'Leaderboard',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="trophy" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}