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
import { useAuth } from '@/src/providers/AuthProvider';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const scrollViewRef = useRef(null);
  const { login, error: authError, loading, needsHealthSetup, healthPermissionStatus } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleLogin = async () => {
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
      await login(email, password);

      // If login is successful (no error from context), check health permissions
      if (!authError) {
        if (needsHealthSetup()) {
          // User needs to set up health permissions
          router.replace('/(onboarding)/health-setup');
        } else if (healthPermissionStatus === 'denied') {
          // User has explicitly denied health permissions
          setLocalError('Health permissions are required to use this app. Please enable them in your device settings.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          // Health permissions are granted, proceed to main app
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace('/(app)/(home)');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
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
            >
              Sign In
            </Button>

            <View style={styles.signUpContainer}>
              <Text variant="bodyLarge" style={styles.signUpText}>
                Don't have an account?
              </Text>
              <Button
                mode="text"
                onPress={() => router.push('/register')}
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
    marginTop: 32,
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
});
