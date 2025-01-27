/**
 * 	•	Basic form validation for email, password length, and password confirmation.
	•	Displays error messages from validation or from AuthProvider.
	•	Shows a loading state if needed.
  	•	localError handles client-side validation errors separately from server-side or Supabase errors (error from AuthProvider).
	•	If the request is successful (no error from the auth context), we navigate the user to /login or another screen.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { isValidEmail, isValidPassword, doPasswordsMatch } from '@/src/utils/validation';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, error, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleRegister = async () => {
    // Clear local error each time user attempts to register
    setLocalError('');

    // Validate inputs locally first
    if (!isValidEmail(email)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (!isValidPassword(password)) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }
    if (!doPasswordsMatch(password, confirmPassword)) {
      setLocalError('Passwords do not match.');
      return;
    }

    // If validation passes, call register
    await register(email, password);

    // If there's no error from AuthProvider, we can navigate.
    if (!error) {
      // Navigate to the login screen or anywhere you prefer
      router.push('/(auth)/login');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

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
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      {loading ? (
        <ActivityIndicator />
      ) : (
        <Button title="Sign Up" onPress={handleRegister} />
      )}

      <Button
        title="Already have an account? Login"
        onPress={() => router.push('/(auth)/login')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  errorText: {
    color: 'red',
    marginBottom: 8,
  },
});