import React, { useState, useRef } from 'react';
import { View, Platform, Keyboard, Pressable, Image, useWindowDimensions } from 'react-native';
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
import { useAuth } from '@/src/providers/auth';
import { authStyles } from '@/src/styles/authStyles';
import AvatarDisplay from '@/src/components/AvatarDisplay';

interface DeviceOptionProps {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  isSelected: boolean;
  onSelect: () => void;
  testID?: string;
}

interface AvatarOptionProps {
  avatarIndex: number;
  isSelected: boolean;
  onSelect: () => void;
}

const DeviceOption = ({ title, icon, isSelected, onSelect, testID }: DeviceOptionProps) => (
  <Pressable 
    testID={testID}
    onPress={onSelect} 
    style={[
      authStyles.deviceOptionWrapper,
      isSelected && authStyles.deviceOptionSelected
    ]}
  >
    <MaterialCommunityIcons 
      name={icon} 
      size={24} 
      color={isSelected ? brandColors.primary : '#64748B'} 
      style={authStyles.deviceIcon}
    />
    <Text style={[
      authStyles.deviceOptionText,
      isSelected && authStyles.deviceOptionTextSelected
    ]} numberOfLines={2}>
      {title}
    </Text>
  </Pressable>
);

const AvatarOption = ({ avatarIndex, isSelected, onSelect }: AvatarOptionProps) => {
  return (
    <Pressable 
      onPress={onSelect} 
      style={[
        authStyles.avatarOption,
        isSelected && authStyles.avatarOptionSelected
      ]}
      testID={`avatar-option-${avatarIndex}`}
      accessibilityLabel={`Avatar option ${avatarIndex}`}
      accessibilityRole="button"
    >
      <AvatarDisplay 
        avatarId={String(avatarIndex)}
        style={authStyles.avatarImage}
      />
    </Pressable>
  );
};

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
  const [measurementSystem, setMeasurementSystem] = useState<'metric' | 'imperial'>('imperial');
  const [selectedAvatar, setSelectedAvatar] = useState<number | null>(null);
  const [localError, setLocalError] = useState<Record<string, string>>({});

  // Available avatars (indices 1-6)
  const avatarOptions = [1, 2, 3, 4, 5, 6];

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
    } else if (displayName.trim().length > 50) {
      errors.displayName = 'Display name must be 50 characters or less';
      hasError = true;
    }

    if (!deviceType) {
      errors.deviceType = 'Please select a device type';
      hasError = true;
    }

    if (selectedAvatar === null) {
      errors.avatar = 'Please select an avatar';
      hasError = true;
    }

    setLocalError(errors);
    if (hasError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    return !hasError;
  };

  const handleRegister = async () => {
    if (loading) {
      console.log('[RegisterScreen] Registration already in progress, ignoring duplicate submit');
      return;
    }
    
    Keyboard.dismiss();
    
    if (!validateForm()) {
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const trimmedDisplayName = displayName.trim();
      if (!trimmedDisplayName) {
        setLocalError({ displayName: 'Display name is required' });
        return;
      }
      
      // Register the user
      await register(email, password, {
        displayName: trimmedDisplayName,
        deviceType: deviceType as 'os' | 'fitbit',
        measurementSystem,
        avatarUri: selectedAvatar !== null ? selectedAvatar.toString() : null,
        showProfile: true
      });

      // Don't request health permissions here - let the auth flow handle it
      // The AuthProvider will automatically request permissions after registration

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('[RegisterScreen] Registration successful, waiting for auth state to update');
      setLocalError({});
    } catch (err) {
      console.error('Registration error:', err);
      if (err instanceof Error) {
        // Handle specific error cases with improved user messages
        if (err.message.includes('already registered') || err.message.includes('already exists')) {
          setLocalError({ 
            email: 'This email is already registered',
            submit: 'This email is already registered. Please sign in instead.' 
          });
          // Focus the email input to make it clear what needs to be changed
          setEmail('');
        } else if (err.message.includes('duplicate key')) {
          setLocalError({ 
            email: 'This email is already registered',
            submit: 'This email is already registered. Please try logging in instead.' 
          });
          setEmail('');
        } else if (err.message.includes('Database error')) {
          setLocalError({ submit: 'Registration failed. Please try again later.' });
        } else if (err.message.includes('password')) {
          // Handle password validation errors specifically
          setLocalError({ 
            password: 'Please check your password format',
            submit: err.message 
          });
        } else {
          setLocalError({ submit: err.message });
        }
      } else {
        setLocalError({ submit: 'An unexpected error occurred during registration.' });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <SafeAreaView style={authStyles.container}>
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          authStyles.scrollContent,
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
          style={authStyles.headerContainer}
          entering={FadeInDown.delay(200).duration(600).springify()}
        >
          <Image 
            source={require('@/assets/images/myLeraBanner.png')}
            style={authStyles.banner}
            resizeMode="contain"
          />
          <Text variant="titleLarge" style={authStyles.headerTitle}>
            Create Account
          </Text>
        </Animated.View>

        <Surface style={authStyles.formContainer}>
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
              style={authStyles.input}
              mode="outlined"
              outlineColor={localError.email ? theme.colors.error : '#E2E8F0'}
              activeOutlineColor={brandColors.primary}
              left={<TextInput.Icon icon="email" color={brandColors.primary} />}
              error={!!localError.email}
              dense
            />
            {localError.email && (
              <HelperText type="error" visible={true} style={authStyles.errorText}>
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
              style={authStyles.input}
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
              <HelperText type="error" visible={true} style={authStyles.errorText}>
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
              style={authStyles.input}
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
              <HelperText type="error" visible={true} style={authStyles.errorText}>
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
              style={authStyles.input}
              mode="outlined"
              outlineColor={localError.displayName ? theme.colors.error : '#E2E8F0'}
              activeOutlineColor={brandColors.primary}
              left={<TextInput.Icon icon="account" color={brandColors.primary} />}
              error={!!localError.displayName}
              dense
            />
            {localError.displayName && (
              <HelperText type="error" visible={true} style={authStyles.errorText}>
                {localError.displayName}
              </HelperText>
            )}

            <Text variant="titleMedium" style={authStyles.sectionTitle}>
              Select an Avatar
            </Text>
            {localError.avatar && (
              <HelperText type="error" visible={true} style={authStyles.errorText}>
                {localError.avatar}
              </HelperText>
            )}
            <View style={authStyles.avatarContainer}>
              {avatarOptions.map((index) => (
                <AvatarOption
                  key={index}
                  avatarIndex={index}
                  isSelected={selectedAvatar === index}
                  onSelect={() => {
                    setSelectedAvatar(index);
                    setLocalError({ ...localError, avatar: '' });
                  }}
                />
              ))}
            </View>

            <Text variant="titleMedium" style={authStyles.sectionTitle}>
              Select Your Device
            </Text>
            {localError.deviceType && (
              <HelperText type="error" visible={true} style={authStyles.errorText}>
                {localError.deviceType}
              </HelperText>
            )}
            <View style={authStyles.deviceContainer}>
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

            <Text variant="titleMedium" style={authStyles.sectionTitle}>
              Measurement System
            </Text>
            <View style={authStyles.measurementContainer}>
              <Button
                testID="metric-button"
                mode={measurementSystem === 'metric' ? 'contained' : 'outlined'}
                onPress={() => {
                  setMeasurementSystem('metric');
                  Keyboard.dismiss();
                }}
                style={[
                  authStyles.measurementButton,
                  measurementSystem === 'metric' && authStyles.measurementButtonSelected
                ]}
                contentStyle={authStyles.measurementButtonContent}
                labelStyle={[
                  authStyles.measurementButtonLabel,
                  measurementSystem === 'metric' && authStyles.measurementButtonLabelSelected
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
                  authStyles.measurementButton,
                  measurementSystem === 'imperial' && authStyles.measurementButtonSelected
                ]}
                contentStyle={authStyles.measurementButtonContent}
                labelStyle={[
                  authStyles.measurementButtonLabel,
                  measurementSystem === 'imperial' && authStyles.measurementButtonLabelSelected
                ]}
              >
                Imperial
              </Button>
            </View>

            {(localError.submit || authError) && (
              <View style={authStyles.errorContainer}>
                <HelperText type="error" visible={true} style={authStyles.submitError}>
                  {localError.submit || authError}
                </HelperText>
                
                {/* Add a quick sign in button if user already exists */}
                {(localError.submit?.includes('already registered') || 
                  localError.submit?.includes('try logging in')) && (
                  <Button
                    testID="quick-sign-in-button"
                    mode="contained"
                    onPress={() => {
                      Keyboard.dismiss();
                      router.replace('/(auth)/login');
                    }}
                    style={authStyles.quickSignInButton}
                    contentStyle={authStyles.quickSignInButtonContent}
                    labelStyle={authStyles.quickSignInButtonLabel}
                  >
                    Go to Sign In
                  </Button>
                )}
              </View>
            )}

            <Button
              testID="register-button"
              mode="contained"
              onPress={handleRegister}
              style={authStyles.button}
              contentStyle={authStyles.buttonContent}
              labelStyle={authStyles.buttonLabel}
              loading={loading}
              disabled={loading}
            >
              Create Account
            </Button>

            <View style={authStyles.signInContainer}>
              <Text variant="bodyLarge" style={authStyles.signInText}>
                Already have an account?
              </Text>
              <Button
                testID="sign-in-button"
                mode="text"
                onPress={() => {
                  Keyboard.dismiss();
                  router.push('/(auth)/login');
                }}
                labelStyle={authStyles.signInButtonLabel}
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