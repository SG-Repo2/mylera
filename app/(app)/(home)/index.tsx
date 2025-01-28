import React from 'react';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderFactory } from '@/src/providers/health';
import { Dashboard } from '@/src/components/metrics/Dashboard';

export default function HomeScreen() {
  const { user } = useAuth();
  const provider = HealthProviderFactory.getProvider();

  if (!user) return null;

  return (
    <Dashboard
      provider={provider}
      userId={user.id}
      showAlerts={true}
    />
  );
}