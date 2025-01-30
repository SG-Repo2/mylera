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
import type { UserProfile } from '../../types/leaderboard';
import { ErrorView } from '../shared/ErrorView';

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
        // Handle case where profile doesn't exist or permission denied
        console.log('Creating default profile for new user');
        try {
          await leaderboardService.updateUserProfile(user.id, {
            display_name: null,
            show_profile: false,
          });
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
        <Text style={styles.title}>Profile</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>
                  {displayName?.charAt(0).toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <Pressable
              style={styles.editAvatarButton}
              onPress={() => {
                // TODO: Implement image picker integration
                console.log('Edit avatar pressed');
              }}
            >
              <MaterialCommunityIcons name="camera" size={16} color="#FFF" />
            </Pressable>
          </View>
        </View>

        {/* Name Section */}
        <View style={styles.nameSection}>
          {editingName ? (
            <TextInput
              style={styles.nameInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display Name"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
          ) : (
            <Text style={styles.displayName}>
              {displayName || 'Anonymous User'}
            </Text>
          )}
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

        <Text style={styles.userId}>{user?.id}</Text>
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
    backgroundColor: '#F9FAFB',
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  profileCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0284c7',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    borderBottomWidth: 2,
    borderBottomColor: '#0284c7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 200,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  editNameButton: {
    padding: 8,
    marginLeft: 8,
  },
  userId: {
    fontSize: 14,
    color: '#6B7280',
  },
  settingsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#374151',
  },
  buttonContainer: {
    paddingHorizontal: 16,
  },
  saveButton: {
    backgroundColor: '#0284c7',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  signOutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});