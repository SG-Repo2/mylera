import React from 'react';
import { View, Text } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderFactory } from '@/src/providers/health';
import { Dashboard } from '@/src/components/metrics/Dashboard';

export default function HomeScreen() {
  const { user } = useAuth();
  const provider = HealthProviderFactory.getProvider();

  if (!user) return null;

  return (
    <View className="flex-1 bg-gray-50">
      <Dashboard
        provider={provider}
        userId={user.id}
      />
    </View>
  );
}
