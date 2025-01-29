/**
 * 	•	We show a local validation error if the email is invalid or the password is too short.
	•	We attempt to login, and if no context error occurs, we navigate to (app)/(home) or wherever your home screen is located.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { isValidEmail, isValidPassword } from '@/src/utils/validation';

export default function LoginScreen() {
  const router = useRouter();
  const { login, error, loading, needsHealthSetup, healthPermissionStatus } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleLogin = async () => {
    setLocalError('');

    // Basic validation
    if (!isValidEmail(email)) {
      setLocalError('Invalid email address.');
      return;
    }
    if (!isValidPassword(password)) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    await login(email, password);

    // If login is successful (no error from context), check health permissions
    if (!error) {
      if (needsHealthSetup()) {
        // User needs to set up health permissions
        router.replace('/(onboarding)/health-setup');
      } else if (healthPermissionStatus === 'denied') {
        // User has explicitly denied health permissions
        setLocalError('Health permissions are required to use this app. Please enable them in your device settings.');
      } else {
        // Health permissions are granted, proceed to main app
        router.replace('/(app)/(home)');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {localError ? <Text style={styles.errorText}>{localError}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {loading ? (
        <ActivityIndicator />
      ) : (
        <Button title="Sign In" onPress={handleLogin} />
      )}

      <Button
        title="Don't have an account? Register"
        onPress={() => router.push('/(auth)/register')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  errorText: {
    color: 'red',
    marginBottom: 8,
    textAlign: 'center',
  },
});