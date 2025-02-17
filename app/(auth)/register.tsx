/**
 * 	•	Basic form validation for email, password length, and password confirmation.
	•	Displays error messages from validation or from AuthProvider.
	•	Shows a loading state if needed.
  	•	localError handles client-side validation errors separately from server-side or Supabase errors (error from AuthProvider).
	•	If the request is successful (no error from the auth context), we navigate the user to /login or another screen.
 */
import React, { useState } from 'react';
import { View, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { Text, TextInput, Button, Surface, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { isValidEmail, isValidPassword, doPasswordsMatch } from '@/src/utils/validation';
import { theme } from '@/src/theme/theme';
import * as ImagePicker from 'expo-image-picker';
import { leaderboardService } from '@/src/services/leaderboardService';

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

  const handleAvatarPick = async () => {
    if (!email) {
      setLocalError('Please enter your email first');
      return;
    }

    try {
      // Request permission first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        setLocalError('Permission to access media library was denied');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0].uri) {
        // Store the URI temporarily - it will be uploaded during registration
        setAvatar(result.assets[0].uri);
      }
    } catch (err) {
      setLocalError('Failed to select avatar image');
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
    setLocalError('');
    
    if (!validateProfile()) {
      return;
    }

    try {
      let avatarUrl = null;
      
      // If an avatar was selected, upload it first
      if (avatar) {
        try {
          // Create a temporary ID for the avatar
          const tempId = `temp-${Date.now()}`;
          avatarUrl = await leaderboardService.uploadAvatar(tempId, avatar);
        } catch (avatarErr) {
          console.error('Failed to upload avatar:', avatarErr);
          // Continue registration without avatar if upload fails
        }
      }

      // Register with additional profile data
      await register(email, password, {
        displayName,
        deviceType: deviceType as 'os' | 'fitbit',
        measurementSystem,
        avatarUri: avatarUrl
      });

      // If successful, AuthProvider will handle the navigation to health-setup
    } catch (err) {
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('An unexpected error occurred during registration.');
      }
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
