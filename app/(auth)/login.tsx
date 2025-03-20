import React, { useState, useRef } from 'react';
import { View, StyleSheet, Platform, Keyboard, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Button,
  TextInput,
  Surface,
  Text,
  useTheme,
  HelperText,
} from 'react-native-paper';
import { brandColors } from '@/src/theme/theme';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { isValidEmail, isValidPassword } from '@/src/utils/validation';
import { useAuth } from '@/src/providers/auth';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const scrollViewRef = useRef(null);
  const { login, error: authError, loading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleLogin = async () => {
    // Prevent multiple submissions
    if (loading) {
      console.log('[LoginScreen] Login already in progress, ignoring duplicate submit');
      return;
    }
    
    Keyboard.dismiss();
    setLocalError('');
    
    // Validate form
    if (!email.trim()) {
      setLocalError('Email is required');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!isValidEmail(email)) {
      setLocalError('Please enter a valid email');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!password) {
      setLocalError('Password is required');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Add delay to ensure navigator is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await login(email, password);
      
      // Don't navigate here - let the AuthProvider handle navigation
      console.log('[LoginScreen] Login successful, waiting for auth state update');
      
    } catch (err) {
      console.error('[LoginScreen] Login error:', err);
      
      // Handle specific error cases
      if (err instanceof Error) {
        if (err.message.includes('Network') || err.message.includes('connect')) {
          setLocalError('Unable to connect to the server. Please check your internet connection.');
        } else if (err.message.includes('Invalid login credentials')) {
          setLocalError('Invalid email or password');
        } else {
          setLocalError(err.message);
        }
      } else {
        setLocalError('An unexpected error occurred');
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[styles.headerContainer, { marginTop: -20 }]}
          entering={FadeInDown.delay(200).duration(600).springify()}
        >
          <Image 
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text variant="headlineLarge" style={[styles.headerTitle, { color: '#1a237e' }]}>
            Welcome Back
          </Text>
          <Text variant="bodyLarge" style={styles.headerSubtitle}>
            Sign in to continue tracking your health journey
          </Text>
        </Animated.View>
        
        <Surface style={[styles.formContainer, { backgroundColor: '#FFFFFF' }]}>
          <Animated.View entering={FadeInDown.delay(400).duration(600).springify()}>
            <TextInput
              testID="email-input"
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.input, { backgroundColor: '#FFFFFF', marginBottom: 8 }]}
              mode="outlined"
              outlineColor={localError && !email ? theme.colors.error : theme.colors.outline}
              activeOutlineColor={brandColors.primary}
              left={<TextInput.Icon icon="email" color={brandColors.primary} />}
              error={!!localError && !email}
            />
            {localError && !email ? (
              <HelperText type="error" visible={true}>
                {localError}
              </HelperText>
            ) : null}
            
            <TextInput
              testID="password-input"
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={[styles.input, { backgroundColor: '#FFFFFF', marginBottom: 8 }]}
              mode="outlined"
              outlineColor={localError && !password ? theme.colors.error : theme.colors.outline}
              activeOutlineColor={brandColors.primary}
              left={<TextInput.Icon icon="lock" color={brandColors.primary} />}
              right={
                <TextInput.Icon
                  testID="toggle-password-visibility"
                  icon={showPassword ? "eye-off" : "eye"}
                  onPress={() => setShowPassword(!showPassword)}
                  forceTextInputFocus={false}
                />
              }
              error={!!localError && !password}
            />
            {localError && !password ? (
              <HelperText type="error" visible={true}>
                {localError}
              </HelperText>
            ) : null}
            
            <Button
              mode="text"
              onPress={() => router.push('/forgot-password')}
              style={[styles.forgotButton, { marginTop: 0 }]}
              labelStyle={[styles.forgotButtonLabel, { color: '#FF9800' }]}
            >
              Forgot Password?
            </Button>
            
            <Button
              mode="contained"
              onPress={handleLogin}
              style={[styles.button, { backgroundColor: '#1a237e', marginTop: 20}]}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              loading={loading}
              disabled={loading}
            >
              Sign In
            </Button>

            {authError && (
              <HelperText type="error" visible={true} style={styles.errorText}>
                {authError}
              </HelperText>
            )}

            <View style={styles.signUpContainer}>
              <Text variant="bodyLarge" style={styles.signUpText}>
                Don't have an account?
              </Text>
              <Button
                mode="text"
                onPress={() => router.push('/(auth)/register')}
                labelStyle={[styles.signUpButtonLabel, { color: '#FF9800' }]}
              >
                Create Account
              </Button>
            </View>
          </Animated.View>
        </Surface>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E1', // Warm neutral background
  },
  scrollContent: {
    padding: 24,
    minHeight: '100%',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  headerTitle: {
    color: brandColors.primary,
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  formContainer: {
    padding: 24,
    borderRadius: 16,
    elevation: 2,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
    }),
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginVertical: 4,
  },
  forgotButtonLabel: {
    fontSize: 14,
  },
  button: {
    marginTop: 24,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 0,
  },
  buttonContent: {
    height: 56,
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signUpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 8,
  },
  signUpText: {
    textAlign: 'center',
  },
  signUpButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 8,
  },
});