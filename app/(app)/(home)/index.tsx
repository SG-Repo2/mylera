import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { HealthProviderFactory } from '@/src/providers/health';
import { Dashboard } from '@/src/components/metrics/Dashboard';
import { theme } from '@/src/theme/theme';

export default function HomeScreen() {
  const { user } = useAuth();
  const provider = useMemo(() => HealthProviderFactory.getProvider(), []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Dashboard
        provider={provider}
        userId={user?.id || ''}
        showAlerts={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});