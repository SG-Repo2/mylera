import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ActivityIndicator,
  Switch,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'expo-router';
import { leaderboardService } from '../../services/leaderboardService';
import { UserProfile } from '../../types/leaderboard';
import { ErrorView } from '../shared/ErrorView';
import { theme } from '../../theme/theme';
import * as ImagePicker from 'expo-image-picker';

// Add spacing constants to match theme
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await leaderboardService.getUserProfile(user.id);
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name ?? '');
        setShowProfile(data.show_profile);
      } else {
        // Handle case where profile doesn't exist
        console.log('Creating default profile for new user');
        try {
          // Get registration data from metadata if available
          const metadata = user.user_metadata || {};
          const defaultProfile = {
            display_name: metadata.displayName || null,
            show_profile: false,
            avatar_url: metadata.avatarUri || null,
            device_type: metadata.deviceType || null,
            measurement_system: metadata.measurementSystem || 'metric',
          };

          await leaderboardService.updateUserProfile(user.id, defaultProfile);
          
          // Retry loading the profile
          const newProfile = await leaderboardService.getUserProfile(user.id);
          if (newProfile) {
            setProfile(newProfile);
            setDisplayName(newProfile.display_name ?? '');
            setShowProfile(newProfile.show_profile);
          }
        } catch (createErr) {
          console.error('Error creating default profile:', createErr);
          throw createErr;
        }
      }
    } catch (err) {
      console.error('Profile error:', err);
      if (err instanceof Error) {
        if (err.message.includes('42501')) {
          setError(new Error('Unable to access profile. Please check your permissions.'));
        } else if (err.message.includes('PGRST200')) {
          setError(new Error('Profile service is temporarily unavailable. Please try again later.'));
        } else {
          setError(err);
        }
      } else {
        setError(new Error('Failed to load profile'));
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadProfile();
  }, [user, loadProfile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      // Validate display name
      const trimmedName = displayName.trim();
      if (trimmedName.length > 50) {
        throw new Error('Display name must be 50 characters or less');
      }

      await leaderboardService.updateUserProfile(user.id, {
        display_name: trimmedName || null,
        show_profile: showProfile,
      });

      try {
        await loadProfile(); // Reload to confirm changes
        setEditingName(false);
      } catch (reloadErr) {
        console.warn('Profile saved but reload failed:', reloadErr);
        // Don't throw here - the save was successful even if reload failed
        // Just update local state
        setProfile(prev => prev ? {
          ...prev,
          display_name: trimmedName || null,
          show_profile: showProfile,
        } : null);
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      if (err instanceof Error) {
        if (err.message.includes('42501')) {
          setError(new Error('You do not have permission to update this profile.'));
        } else if (err.message.includes('PGRST200')) {
          setError(new Error('Profile service is temporarily unavailable. Please try again later.'));
        } else {
          setError(err);
        }
      } else {
        setError(new Error('Failed to update profile'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sign out'));
    }
  };

  const handleAvatarUpdate = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Request permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError(new Error('Permission to access media library was denied'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset.uri) {
          throw new Error('No image URI available');
        }

        try {
          // Upload the image
          const publicUrl = await leaderboardService.uploadAvatar(user.id, asset.uri);
          
          if (!publicUrl) {
            throw new Error('Failed to get public URL for uploaded avatar');
          }

          // Update profile with new avatar URL
          await leaderboardService.updateUserProfile(user.id, {
            ...profile,
            avatar_url: publicUrl
          });

          // Reload profile
          await loadProfile();
        } catch (uploadError) {
          console.error('Error during avatar upload:', uploadError);
          throw new Error('Failed to upload avatar. Please try again.');
        }
      }
    } catch (err) {
      console.error('Error updating avatar:', err);
      setError(err instanceof Error ? err : new Error('Failed to update avatar'));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profile && !error) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  if (error) {
    return <ErrorView error={error} onRetry={loadProfile} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <Pressable style={styles.avatarWrapper} onPress={handleAvatarUpdate}>
            {profile?.avatar_url ? (
              <Image 
                source={{ uri: profile.avatar_url }} 
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View style={styles.editAvatarButton}>
              <MaterialCommunityIcons name="camera" size={16} color="#FFF" />
            </View>
          </Pressable>
        </View>

        {/* Name Section */}
        <View style={styles.nameSection}>
          {editingName ? (
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display Name"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
          ) : (
            <View style={styles.displayNameContainer}>
              <Text style={styles.displayName}>
                {displayName || 'Anonymous User'}
              </Text>
              <Pressable
                style={styles.editNameButton}
                onPress={() => setEditingName(!editingName)}
              >
                <MaterialCommunityIcons
                  name={editingName ? 'close' : 'pencil'}
                  size={20}
                  color="#6B7280"
                />
              </Pressable>
            </View>
          )}
        </View>

        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Settings Card */}
      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Show Profile Publicly</Text>
          <Switch
            value={showProfile}
            onValueChange={setShowProfile}
            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
            thumbColor={showProfile ? '#0284c7' : '#F3F4F6'}
          />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Pressable
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="content-save"
                size={20}
                color="#FFF"
                style={styles.buttonIcon}
              />
              <Text style={styles.buttonText}>Save Changes</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <MaterialCommunityIcons
            name="logout"
            size={20}
            color="#FFF"
            style={styles.buttonIcon}
          />
          <Text style={styles.buttonText}>Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: spacing.xl,
  },
  headerTitle: {
    ...theme.fonts.headlineMedium,
    color: theme.colors.onBackground,
  },
  errorText: {
    ...theme.fonts.bodySmall,
    color: theme.colors.error,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: spacing.lg,
    elevation: 1,
  },
  sectionTitle: {
    ...theme.fonts.titleLarge,
    color: theme.colors.onSurface,
    marginBottom: spacing.md,
  },
  form: {
    gap: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  profileCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: spacing.lg,
    elevation: 1,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: spacing.lg,
    elevation: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.colors.primary,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...theme.fonts.headlineMedium,
    color: theme.colors.onPrimary,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  editNameButton: {
    padding: 8,
    marginLeft: 8,
  },
  email: {
    ...theme.fonts.bodyLarge,
    color: theme.colors.onSurfaceVariant,
  },
  settingsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  settingLabel: {
    ...theme.fonts.bodyLarge,
    color: theme.colors.onSurface,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    gap: spacing.sm,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButton: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.roundness,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  displayNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  displayName: {
    ...theme.fonts.titleLarge,
    color: theme.colors.onSurface,
  },
  input: {
    ...theme.fonts.titleLarge,
    color: theme.colors.onSurface,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minWidth: 200,
  },
});
