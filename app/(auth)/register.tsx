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

// Step type for multi-step form
type RegistrationStep = 'credentials' | 'profile';

interface DeviceOptionProps {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  isSelected: boolean;
  onSelect: () => void;
}

const DeviceOption = ({ title, icon, isSelected, onSelect }: DeviceOptionProps) => (
  <Pressable onPress={onSelect}>
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
      if (avatar) {
        setAvatar(null);
      }
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
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        exif: false,
      });

      console.log('[Register] Picker result:', JSON.stringify(pickerResult, null, 2));

    } catch (err) {
      console.error('[Register] Avatar selection error:', err);
      setLocalError('Failed to select image. Please try again.');
    } finally {
      setIsPickerActive(false);
    }

    if (!pickerResult?.canceled && pickerResult?.assets?.[0]?.uri) {
      console.log('[Register] Setting avatar URI:', pickerResult.assets[0].uri);
      setAvatar(pickerResult.assets[0].uri);
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
    if (!deviceType) {
      setLocalError('Please select a device type');
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
    console.log('[Register] Starting registration process');
    setLocalError('');
    
    if (!validateProfile()) {
      return;
    }

    try {
      setIsUploading(true);
      let avatarUrl = null;
      
      if (avatar) {
        console.log('[Register] Attempting to upload avatar');
        try {
          // Verify the avatar URI is still valid
          const checkFile = await fetch(avatar);
          if (!checkFile.ok) {
            throw new Error('Avatar file is no longer accessible');
          }

          const tempId = `temp_${Date.now()}`;
          console.log('[Register] Generated temp ID for avatar:', tempId);
          
          avatarUrl = await leaderboardService.uploadAvatar(tempId, avatar)
            .catch(error => {
              console.error('[Register] Avatar upload error details:', error);
              throw new Error('Failed to upload profile picture. Please try again.');
            });

          console.log('[Register] Avatar uploaded successfully:', avatarUrl);
        } catch (avatarErr) {
          console.error('[Register] Avatar upload failed:', avatarErr);
          setLocalError('Failed to upload profile picture. Please try again.');
          return;
        }
      }

      console.log('[Register] Calling register with profile data:', {
        displayName,
        deviceType,
        measurementSystem,
        avatarUri: avatarUrl
      });

      try {
        await register(email, password, {
          displayName,
          deviceType: deviceType as 'os' | 'fitbit',
          measurementSystem,
          avatarUri: avatarUrl
        });
        
        // Navigate to health setup after successful registration
        router.replace('/(onboarding)/health-setup');
      } catch (registerError) {
        console.error('[Register] Registration error:', registerError);
        
        // If we uploaded an avatar but registration failed, try to clean it up
        if (avatarUrl) {
          try {
            // Extract file path from URL
            const url = new URL(avatarUrl);
            const filePath = url.pathname.split('/').slice(-2).join('/');
            await supabase.storage
              .from('avatars')
              .remove([filePath]);
            console.log('[Register] Cleaned up avatar after failed registration');
          } catch (cleanupError) {
            console.error('[Register] Failed to cleanup avatar:', cleanupError);
          }
        }
        
        throw registerError;
      }

    } catch (err) {
      console.error('[Register] Error:', err);
      setLocalError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
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
          <Button 
            mode="contained"
            onPress={handleNextStep}
            style={styles.button}
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
          />

          <Text style={styles.sectionTitle}>Select Your Device</Text>
          <DeviceOption
            title="Apple Health / Google Fit"
            icon="cellphone"
            isSelected={deviceType === 'os'}
            onSelect={() => setDeviceType('os')}
          />
          <DeviceOption
            title="Fitbit"
            icon="watch"
            isSelected={deviceType === 'fitbit'}
            onSelect={() => setDeviceType('fitbit')}
          />

          <Text style={styles.sectionTitle}>Measurement System</Text>
          <View style={styles.measurementContainer}>
            <Button
              mode={measurementSystem === 'metric' ? 'contained' : 'outlined'}
              onPress={() => setMeasurementSystem('metric')}
            >
              Metric
            </Button>
            <Button
              mode={measurementSystem === 'imperial' ? 'contained' : 'outlined'}
              onPress={() => setMeasurementSystem('imperial')}
            >
              Imperial
            </Button>
          </View>

          <Text style={styles.sectionTitle}>Profile Picture (Optional)</Text>
          <Pressable onPress={handleAvatarPick} style={styles.avatarContainer}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <MaterialCommunityIcons name="camera-plus" size={32} color={theme.colors.primary} />
            )}
          </Pressable>

          {loading ? (
            <ActivityIndicator />
          ) : (
            <Button 
              mode="contained"
              onPress={handleRegister}
              style={styles.button}
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