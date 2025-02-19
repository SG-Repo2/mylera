import React, { useState, useRef } from 'react';
import { View, StyleSheet, Platform, Keyboard, Pressable, Image, useWindowDimensions } from 'react-native';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { brandColors } from '@/src/theme/theme';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { isValidEmail, isValidPassword, doPasswordsMatch } from '@/src/utils/validation';
import { useAuth } from '@/src/providers/AuthProvider';

interface DeviceOptionProps {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  isSelected: boolean;
  onSelect: () => void;
  testID?: string;
}

const DeviceOption = ({ title, icon, isSelected, onSelect }: DeviceOptionProps) => (
  <Pressable 
    onPress={onSelect} 
    style={[
      styles.deviceOptionWrapper,
      isSelected && styles.deviceOptionSelected
    ]}
  >
    <MaterialCommunityIcons 
      name={icon} 
      size={24} 
      color={isSelected ? brandColors.primary : '#64748B'} 
      style={styles.deviceIcon}
    />
    <Text style={[
      styles.deviceOptionText,
      isSelected && styles.deviceOptionTextSelected
    ]} numberOfLines={2}>
      {title}
    </Text>
  </Pressable>
);

export default function RegisterScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const scrollViewRef = useRef<KeyboardAwareScrollView>(null);
  const { register, error: authError, loading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [deviceType, setDeviceType] = useState<'os' | 'fitbit' | ''>('');
  const [measurementSystem, setMeasurementSystem] = useState<'metric' | 'imperial'>('metric');
  const [localError, setLocalError] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};
    let hasError = false;

    if (!email.trim()) {
      errors.email = 'Email is required';
      hasError = true;
    } else if (!isValidEmail(email)) {
      errors.email = 'Please enter a valid email';
      hasError = true;
    }

    if (!password) {
      errors.password = 'Password is required';
      hasError = true;
    } else if (!isValidPassword(password)) {
      errors.password = 'Password must be at least 8 characters with uppercase, lowercase, and a number';
      hasError = true;
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
      hasError = true;
    } else if (!doPasswordsMatch(password, confirmPassword)) {
      errors.confirmPassword = 'Passwords do not match';
      hasError = true;
    }

    if (!displayName.trim()) {
      errors.displayName = 'Display name is required';
      hasError = true;
    }

    if (!deviceType) {
      errors.deviceType = 'Please select a device type';
      hasError = true;
    }

    setLocalError(errors);
    if (hasError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    return !hasError;
  };

  const handleRegister = async () => {
    Keyboard.dismiss();
    
    if (!validateForm()) {
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await register(email, password, {
        displayName,
        deviceType: deviceType as 'os' | 'fitbit',
        measurementSystem,
        avatarUri: null
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Registration error:', err);
      if (err instanceof Error) {
        setLocalError({ submit: err.message });
      } else {
        setLocalError({ submit: 'An unexpected error occurred during registration.' });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent,
          { minHeight: height }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 40}
        enableResetScrollToCoords={false}
        keyboardDismissMode="on-drag"
      >
        <Animated.View 
          style={styles.headerContainer}
          entering={FadeInDown.delay(200).duration(600).springify()}
        >
          <Image 
            source={require('@/assets/images/myLeraBanner.png')}
            style={styles.banner}
            resizeMode="contain"
          />
          <Text variant="titleLarge" style={styles.headerTitle}>
            Create Account
          </Text>
        </Animated.View>

        <Surface style={styles.formContainer}>
          <Animated.View entering={FadeInDown.delay(400).duration(600).springify()}>
            <TextInput
              testID="email-input"
              label="Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setLocalError({ ...localError, email: '' });
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              mode="outlined"
              outlineColor={localError.email ? theme.colors.error : '#E2E8F0'}
              activeOutlineColor={brandColors.primary}
              left={<TextInput.Icon icon="email" color={brandColors.primary} />}
              error={!!localError.email}
              dense
            />
            {localError.email && (
              <HelperText type="error" visible={true} style={styles.errorText}>
                {localError.email}
              </HelperText>
            )}

            <TextInput
              testID="password-input"
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setLocalError({ ...localError, password: '' });
              }}
              secureTextEntry={!showPassword}
              style={styles.input}
              mode="outlined"
              outlineColor={localError.password ? theme.colors.error : '#E2E8F0'}
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
              error={!!localError.password}
              dense
            />
            {localError.password && (
              <HelperText type="error" visible={true} style={styles.errorText}>
                {localError.password}
              </HelperText>
            )}

            <TextInput
              testID="confirm-password-input"
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setLocalError({ ...localError, confirmPassword: '' });
              }}
              secureTextEntry={!showConfirmPassword}
              style={styles.input}
              mode="outlined"
              outlineColor={localError.confirmPassword ? theme.colors.error : '#E2E8F0'}
              activeOutlineColor={brandColors.primary}
              left={<TextInput.Icon icon="lock-check" color={brandColors.primary} />}
              right={
                <TextInput.Icon
                  testID="toggle-confirm-password-visibility"
                  icon={showConfirmPassword ? "eye-off" : "eye"}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  forceTextInputFocus={false}
                />
              }
              error={!!localError.confirmPassword}
              dense
            />
            {localError.confirmPassword && (
              <HelperText type="error" visible={true} style={styles.errorText}>
                {localError.confirmPassword}
              </HelperText>
            )}

            <TextInput
              testID="display-name-input"
              label="Display Name"
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                setLocalError({ ...localError, displayName: '' });
              }}
              style={styles.input}
              mode="outlined"
              outlineColor={localError.displayName ? theme.colors.error : '#E2E8F0'}
              activeOutlineColor={brandColors.primary}
              left={<TextInput.Icon icon="account" color={brandColors.primary} />}
              error={!!localError.displayName}
              dense
            />
            {localError.displayName && (
              <HelperText type="error" visible={true} style={styles.errorText}>
                {localError.displayName}
              </HelperText>
            )}

            <Text variant="titleMedium" style={styles.sectionTitle}>
              Select Your Device
            </Text>
            {localError.deviceType && (
              <HelperText type="error" visible={true} style={styles.errorText}>
                {localError.deviceType}
              </HelperText>
            )}
            <View style={styles.deviceContainer}>
              <DeviceOption
                testID="os-device-option"
                title="Mobile"
                icon="cellphone"
                isSelected={deviceType === 'os'}
                onSelect={() => {
                  setDeviceType('os');
                  setLocalError({ ...localError, deviceType: '' });
                  Keyboard.dismiss();
                }}
              />
              <DeviceOption
                testID="fitbit-device-option"
                title="Fitbit"
                icon="watch"
                isSelected={deviceType === 'fitbit'}
                onSelect={() => {
                  setDeviceType('fitbit');
                  setLocalError({ ...localError, deviceType: '' });
                  Keyboard.dismiss();
                }}
              />
            </View>

            <Text variant="titleMedium" style={styles.sectionTitle}>
              Measurement System
            </Text>
            <View style={styles.measurementContainer}>
              <Button
                testID="metric-button"
                mode={measurementSystem === 'metric' ? 'contained' : 'outlined'}
                onPress={() => {
                  setMeasurementSystem('metric');
                  Keyboard.dismiss();
                }}
                style={[
                  styles.measurementButton,
                  measurementSystem === 'metric' && styles.measurementButtonSelected
                ]}
                contentStyle={styles.measurementButtonContent}
                labelStyle={[
                  styles.measurementButtonLabel,
                  measurementSystem === 'metric' && styles.measurementButtonLabelSelected
                ]}
              >
                Metric
              </Button>
              <Button
                testID="imperial-button"
                mode={measurementSystem === 'imperial' ? 'contained' : 'outlined'}
                onPress={() => {
                  setMeasurementSystem('imperial');
                  Keyboard.dismiss();
                }}
                style={[
                  styles.measurementButton,
                  measurementSystem === 'imperial' && styles.measurementButtonSelected
                ]}
                contentStyle={styles.measurementButtonContent}
                labelStyle={[
                  styles.measurementButtonLabel,
                  measurementSystem === 'imperial' && styles.measurementButtonLabelSelected
                ]}
              >
                Imperial
              </Button>
            </View>

            {localError.submit && (
              <HelperText type="error" visible={true} style={styles.submitError}>
                {localError.submit}
              </HelperText>
            )}

            <Button
              testID="register-button"
              mode="contained"
              onPress={handleRegister}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              loading={loading}
              disabled={loading}
            >
              Create Account
            </Button>

            <View style={styles.signInContainer}>
              <Text variant="bodyLarge" style={styles.signInText}>
                Already have an account?
              </Text>
              <Button
                testID="sign-in-button"
                mode="text"
                onPress={() => {
                  Keyboard.dismiss();
                  router.push('/login');
                }}
                labelStyle={styles.signInButtonLabel}
              >
                Sign In
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
    backgroundColor: brandColors.neutral,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  banner: {
    width: '80%',
    height: 40,
    marginBottom: 8,
  },
  headerTitle: {
    color: brandColors.primary,
    fontSize: 24,
    marginBottom: 4,
  },
  formContainer: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  input: {
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    height: 48,
  },
  errorText: {
    marginBottom: 8,
    fontSize: 12,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    color: brandColors.primary,
    fontSize: 18,
  },
  deviceContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  deviceOptionWrapper: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceOptionSelected: {
    backgroundColor: `${brandColors.primary}10`,
    borderColor: brandColors.primary,
  },
  deviceIcon: {
    opacity: 0.8,
  },
  deviceOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
  },
  deviceOptionTextSelected: {
    color: brandColors.primary,
    fontWeight: '600',
  },
  measurementContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  measurementButton: {
    flex: 1,
    borderRadius: 100,
    borderColor: '#E2E8F0',
  },
  measurementButtonSelected: {
    backgroundColor: brandColors.primary,
  },
  measurementButtonContent: {
    height: 40,
  },
  measurementButtonLabel: {
    fontSize: 14,
    letterSpacing: 0,
    color: '#64748B',
  },
  measurementButtonLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  submitError: {
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 12,
  },
  button: {
    marginTop: 4,
    marginBottom: 16,
    borderRadius: 100,
    backgroundColor: brandColors.primary,
  },
  buttonContent: {
    height: 44,
  },
  buttonLabel: {
    fontSize: 16,
    letterSpacing: 0,
    fontWeight: '600',
  },
  signInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  signInText: {
    color: '#64748B',
    fontSize: 14,
  },
  signInButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: brandColors.secondary,
  },
});