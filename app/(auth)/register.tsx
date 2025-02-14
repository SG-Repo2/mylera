/**
 * 	•	Basic form validation for email, password length, and password confirmation.
	•	Displays error messages from validation or from AuthProvider.
	•	Shows a loading state if needed.
  	•	localError handles client-side validation errors separately from server-side or Supabase errors (error from AuthProvider).
	•	If the request is successful (no error from the auth context), we navigate the user to /login or another screen.
 */
import React, { useState, useEffect } from 'react';
import { View, ScrollView, Image, Pressable, StyleSheet, BackHandler } from 'react-native';
import { Text, TextInput, Button, Surface, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { isValidEmail, isValidPassword, doPasswordsMatch } from '@/src/utils/validation';
import { theme } from '@/src/theme/theme';
import * as ImagePicker from 'expo-image-picker';
import { leaderboardService } from '@/src/services/leaderboardService';
import { supabase } from '@/src/services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FORM_STATE_KEY = '@register_form_state';
const AVATAR_URI_KEY = '@register_avatar_uri';

// Step type for multi-step form
type RegistrationStep = 'credentials' | 'profile';

interface DeviceOptionProps {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  isSelected: boolean;
  onSelect: () => void;
  testID?: string;
}

const DeviceOption = ({ title, icon, isSelected, onSelect, testID }: DeviceOptionProps) => (
  <Pressable onPress={onSelect} testID={testID}>
    <Surface style={[
      styles.deviceOption,
      isSelected && styles.deviceOptionSelected
    ]}>
      <MaterialCommunityIcons 
        name={icon} 
        size={24} 
        color={isSelected ? theme.colors.primary : theme.colors.onSurface} 
      />
      <Text style={[
        styles.deviceOptionText,
        isSelected && styles.deviceOptionTextSelected
      ]}>
        {title}
      </Text>
      {isSelected && (
        <MaterialCommunityIcons 
          name="check-circle" 
          size={24} 
          color={theme.colors.primary} 
        />
      )}
    </Surface>
  </Pressable>
);

export default function RegisterScreen() {
  const router = useRouter();
  const { register, error: authError, loading } = useAuth();
  
  // Form state
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [deviceType, setDeviceType] = useState<'os' | 'fitbit' | ''>('');
  const [measurementSystem, setMeasurementSystem] = useState<'metric' | 'imperial'>('metric');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      setIsUploading(false);
      setAvatar(null);
      AsyncStorage.removeItem(AVATAR_URI_KEY).catch(console.error);
    };
  }, []);

  // Handle navigation state
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (isPickerActive) {
          return true;
        }
        return false;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
        if (avatar) {
          setAvatar(null);
        }
      };
    }, [isPickerActive, avatar])
  );

  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleAvatarPick = async () => {
    console.log('[Register] Starting avatar pick process');
    if (!email) {
      setLocalError('Please enter your email first');
      return;
    }

    let pickerResult = null;
    try {
      setIsPickerActive(true);
      console.log('[Register] Requesting media library permissions');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('[Register] Media library permission denied');
        setLocalError('Permission to access media library was denied');
        return;
      }

      console.log('[Register] Launching image picker');
      pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        exif: false,
        base64: true, // Get base64 to check file size
      });

      console.log('[Register] Picker result received');

      if (!pickerResult?.canceled && pickerResult?.assets?.[0]) {
        const selectedAsset = pickerResult.assets[0];
        
        // Check file size using base64 length
        if (selectedAsset.base64) {
          const sizeInBytes = (selectedAsset.base64.length * 0.75);
          if (sizeInBytes > MAX_IMAGE_SIZE) {
            throw new Error('Selected image is too large. Please choose an image under 5MB.');
          }
        }

        console.log('[Register] Setting avatar URI:', selectedAsset.uri);
        setAvatar(selectedAsset.uri);
      }

    } catch (err) {
      console.error('[Register] Avatar selection error:', err);
      setLocalError(err instanceof Error ? err.message : 'Failed to select image. Please try again.');
      setAvatar(null); // Clear any partially set avatar
    } finally {
      setIsPickerActive(false);
    }
  };

  const validateCredentials = () => {
    if (!isValidEmail(email)) {
      setLocalError('Please enter a valid email address.');
      return false;
    }
    if (!isValidPassword(password)) {
      setLocalError('Password must be at least 6 characters long.');
      return false;
    }
    if (!doPasswordsMatch(password, confirmPassword)) {
      setLocalError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const validateProfile = () => {
    if (!displayName.trim()) {
      setLocalError('Please enter a display name');
      return false;
    }
    if (!deviceType || !['os', 'fitbit'].includes(deviceType)) {
      setLocalError('Please select a device type (OS or Fitbit)');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    setLocalError('');
    if (currentStep === 'credentials' && validateCredentials()) {
      setCurrentStep('profile');
    }
  };

  const handleRegister = async () => {
    try {
        if (loading || isUploading) return;
        
        setIsUploading(true);
        console.log('[Register] Starting registration process');

        await register(email, password, {
            displayName,
            deviceType: deviceType as 'os' | 'fitbit',
            measurementSystem,
            avatarUri: avatar
        });

        // Clear sensitive data
        setPassword('');
        setConfirmPassword('');
        setAvatar(null);

        // Clear stored form data
        await Promise.all([
            AsyncStorage.removeItem(FORM_STATE_KEY),
            AsyncStorage.removeItem(AVATAR_URI_KEY)
        ]);

        console.log('[Register] Registration successful, proceeding to health setup');
        router.replace('/(onboarding)/health-setup');

    } catch (err) {
        console.error('[Register] Registration error:', err);
        setLocalError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
      {localError ? <Text style={styles.errorText}>{localError}</Text> : null}

      {currentStep === 'credentials' ? (
        // Step 1: Credentials
        <View>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="email-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="password-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            testID="confirm-password-input"
          />
          <Button 
            mode="contained"
            onPress={handleNextStep}
            style={styles.button}
            testID="next-button"
          >
            Next
          </Button>
        </View>
      ) : (
        // Step 2: Profile
        <View>
          <TextInput
            style={styles.input}
            placeholder="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            testID="display-name-input"
          />

          <Text style={styles.sectionTitle}>Select Your Device</Text>
          <DeviceOption
            title="Apple Health / Google Fit"
            icon="cellphone"
            isSelected={deviceType === 'os'}
            onSelect={() => setDeviceType('os')}
            testID="os-device-option"
          />
          <DeviceOption
            title="Fitbit"
            icon="watch"
            isSelected={deviceType === 'fitbit'}
            onSelect={() => setDeviceType('fitbit')}
            testID="fitbit-device-option"
          />

          <Text style={styles.sectionTitle}>Measurement System</Text>
          <View style={styles.measurementContainer}>
            <Button
              mode={measurementSystem === 'metric' ? 'contained' : 'outlined'}
              onPress={() => setMeasurementSystem('metric')}
              testID="metric-button"
            >
              Metric
            </Button>
            <Button
              mode={measurementSystem === 'imperial' ? 'contained' : 'outlined'}
              onPress={() => setMeasurementSystem('imperial')}
              testID="imperial-button"
            >
              Imperial
            </Button>
          </View>

          <Text style={styles.sectionTitle}>Profile Picture (Optional)</Text>
          <Pressable 
            onPress={handleAvatarPick} 
            style={styles.avatarContainer}
            testID="avatar-picker"
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View testID="avatar-placeholder">
                <MaterialCommunityIcons name="camera-plus" size={32} color={theme.colors.primary} />
              </View>
            )}
          </Pressable>

          {loading ? (
            <ActivityIndicator testID="loading-indicator" />
          ) : (
            <Button 
              mode="contained"
              onPress={handleRegister}
              style={styles.button}
              testID="create-account-button"
            >
              Create Account
            </Button>
          )}
        </View>
      )}

      <Button
        mode="text"
        onPress={() => router.push('/(auth)/login')}
        style={styles.button}
        testID="login-link"
      >
        Already have an account? Login
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 40,
    backgroundColor: theme.colors.background,
  },
  title: {
    ...theme.fonts.headlineMedium,
    color: theme.colors.onBackground,
    marginBottom: 16,
  },
  input: {
    height: 40,
    borderColor: theme.colors.outline,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.surface,
    color: theme.colors.onSurface,
  },
  errorText: {
    ...theme.fonts.bodySmall,
    color: theme.colors.error,
    marginBottom: 8,
  },
  deviceOption: {
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.colors.outline,
  },
  deviceOptionSelected: {
    backgroundColor: theme.colors.primaryContainer,
    borderColor: theme.colors.primary,
  },
  deviceOptionText: {
    ...theme.fonts.bodyMedium,
    color: theme.colors.onSurface,
  },
  deviceOptionTextSelected: {
    ...theme.fonts.bodyMedium,
    color: theme.colors.primary,
  },
  sectionTitle: {
    ...theme.fonts.headlineSmall,
    color: theme.colors.onBackground,
    marginBottom: 12,
  },
  measurementContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  button: {
    marginTop: 12,
  },
});
