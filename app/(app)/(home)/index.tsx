import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderFactory } from '@/src/providers/health';
import { Dashboard } from '@/src/components/metrics/Dashboard';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const provider = useMemo(() => HealthProviderFactory.getProvider(), []);

  React.useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <Dashboard
        provider={provider}
        userId={user.id}
        showAlerts={true}
      />
    </View>
  );
}