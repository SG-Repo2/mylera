import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { createHealthProvider } from '@/src/providers/health/factory/HealthProviderFactory';

export default function HealthSetupScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('Awaiting user action...');

  const handleSetupApple = async () => {
    // Optionally store 'apple' in Supabase as user preference
    const provider = createHealthProvider('apple');
    const granted = await provider.requestPermissions();
    setStatus(granted ? 'Apple HealthKit Granted' : 'Apple HealthKit Denied');

    // If granted, navigate to your main (app) or next onboarding step
    if (granted) router.replace('/(app)/(home)');
  };

  const handleSetupGoogle = async () => {
    // Optionally store 'google' in Supabase as user preference
    const provider = createHealthProvider('google');
    const granted = await provider.requestPermissions();
    setStatus(granted ? 'Google Health Granted' : 'Google Health Denied');

    if (granted) router.replace('/(app)/(home)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Health Setup</Text>

      <Text style={styles.status}>{status}</Text>

      <Button title="Set up Apple Health" onPress={handleSetupApple} />
      <Button title="Set up Google Health" onPress={handleSetupGoogle} />

      <Button
        title="Skip for now"
        onPress={() => router.replace('/(app)/(home)')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    alignItems: 'center',
    paddingTop: 40,
  },
  title: {
    fontSize: 22,
    marginBottom: 16,
  },
  status: {
    marginVertical: 12,
    fontSize: 16,
  },
});
