import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, error, session } = useAuth();

  // If user is already authenticated, redirect to metrics
  if (session) {
    return <Redirect href="../(app)/metrics" />;
  }

  const handleLogin = async () => {
    if (!email || !password) return;
    
    setIsLoading(true);
    try {
      await signIn(email, password);
      // Router will automatically redirect due to session change
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-4">
          <View className="mb-8">
            <Text className="text-3xl font-bold text-center text-primary">MyLera</Text>
            <Text className="text-base text-center text-text-secondary mt-2">
              Sign in to your account
            </Text>
          </View>

          <View className="space-y-4">
            {/* Email Input */}
            <View>
              <Text className="text-sm text-text-secondary mb-1">Email</Text>
              <TextInput
                className="bg-white p-3 rounded-lg border border-gray-200"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            {/* Password Input */}
            <View>
              <Text className="text-sm text-text-secondary mb-1">Password</Text>
              <TextInput
                className="bg-white p-3 rounded-lg border border-gray-200"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />
            </View>

            {/* Error Message */}
            {error && (
              <Text className="text-status-error text-sm text-center">
                {error}
              </Text>
            )}

            {/* Login Button */}
            <Pressable
              className={`
                bg-primary px-4 py-3 rounded-lg mt-4
                ${(!email || !password) ? 'opacity-50' : 'opacity-100'}
              `}
              onPress={handleLogin}
              disabled={!email || !password || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-center">
                  Sign In
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}