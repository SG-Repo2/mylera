import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';
import { useAuth } from '@/src/providers/AuthProvider';
import { theme } from '@/src/theme/theme';

export default function HealthSetupScreen() {
  const router = useRouter();
  const { requestHealthPermissions, healthPermissionStatus, error } = useAuth();
  const [status, setStatus] = useState<string>('Awaiting user action...');
  const [retryCount, setRetryCount] = useState(0);
  const [initError, setInitError] = useState<string | null>(null);

  // Effect to handle initial health permission status
  useEffect(() => {
    if (healthPermissionStatus === 'granted') {
      router.replace('/(app)/(home)');
    } else if (healthPermissionStatus === 'denied' && retryCount > 2) {
      if (Platform.OS === 'android') {
        setStatus('Health permissions have been denied. Please check Health Connect settings.');
      } else {
        setStatus(
          'Health permissions have been denied. Please enable them in your device settings.'
        );
      }
    }
  }, [healthPermissionStatus, retryCount, router]);

  const handleSetupHealth = async () => {
    try {
      setInitError(null);
      setStatus('Initializing health services...');
      console.log('[HealthSetup] Setting up health integration');

      const result = await requestHealthPermissions().catch(error => {
        console.error('[HealthSetup] Health setup error:', error);
        if (error.message?.includes('not available')) {
          setInitError('Health Connect not found');
          return 'unavailable';
        }
        throw error;
      });

      if (result === 'unavailable' && Platform.OS === 'android') {
        setStatus(
          'Health Connect is not available. Please ensure Health Connect is installed and enabled.'
        );
        return;
      }

      if (result === 'granted') {
        console.log('[HealthSetup] Health permissions granted');
        setStatus('Health access granted');
        router.replace('/(app)/(home)');
      } else if (result === 'denied') {
        console.log('[HealthSetup] Health permissions denied');
        setRetryCount(prev => prev + 1);
        if (Platform.OS === 'android') {
          setStatus(
            'Health Connect access denied. Please check Health Connect settings and try again.'
          );
        } else {
          setStatus('Health access denied. Please check device settings and try again.');
        }
      } else {
        console.log('[HealthSetup] Permission request failed with result:', result);
        setStatus('Permission request failed. Please try again.');
      }
    } catch (err) {
      console.error('[HealthSetup] Error during health setup:', err);
      setRetryCount(prev => prev + 1);
      if (err instanceof Error) {
        if (err.message.includes('42501')) {
          setStatus('Unable to save health settings. Please try again later.');
        } else {
          setStatus(`Error: ${err.message}`);
        }
      } else {
        setStatus('An unexpected error occurred');
      }
    }
  };

  const handleSkip = () => {
    // Show warning before skipping
    Alert.alert(
      'Skip Health Integration?',
      'Some features may be limited without health data access. You can enable this later in your profile settings.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: () => router.replace('/(app)/(home)'),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Health Integration Setup</Text>

      <View style={styles.infoContainer}>
        <Text style={styles.description}>
          Connect your health data to track your fitness progress and compete with friends.
        </Text>

        {initError === 'Health Connect not found' && Platform.OS === 'android' ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Health Connect is required but not found. Please ensure Health Connect is installed
              and enabled in your device settings.
            </Text>
          </View>
        ) : (
          <Text style={[styles.status, healthPermissionStatus === 'denied' && styles.errorText]}>
            {status}
          </Text>
        )}

        {healthPermissionStatus === 'denied' && retryCount > 2 && Platform.OS === 'android' && (
          <Text style={styles.errorText}>
            Please open Health Connect settings and ensure all permissions are granted.
          </Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title={retryCount > 0 ? 'Retry Health Setup' : 'Set up Health Integration'}
          onPress={handleSetupHealth}
        />

        <View style={styles.skipButtonContainer}>
          <Button title="Skip for now" onPress={handleSkip} color="#666" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    width: '100%',
  },
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  description: {
    ...theme.fonts.bodyLarge,
    color: theme.colors.onSurfaceVariant,
    lineHeight: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: theme.colors.errorContainer,
    borderRadius: 8,
    marginVertical: 12,
    padding: 16,
  },
  errorText: {
    ...theme.fonts.bodyMedium,
    color: theme.colors.error,
    marginTop: 8,
    textAlign: 'center',
  },
  infoContainer: {
    marginBottom: 32,
  },
  skipButtonContainer: {
    marginTop: 12,
  },
  status: {
    ...theme.fonts.bodyMedium,
    color: theme.colors.onSurfaceVariant,
    marginVertical: 12,
    textAlign: 'center',
  },
  title: {
    ...theme.fonts.headlineLarge,
    color: theme.colors.onBackground,
    marginBottom: 24,
    textAlign: 'center',
  },
});
