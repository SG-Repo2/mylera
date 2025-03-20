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
  Modal,
  FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../providers/auth';
import { useRouter } from 'expo-router';
import { leaderboardService } from '../../services/leaderboardService';
import { UserProfile } from '../../types/leaderboard';
import { ErrorView } from '../shared/ErrorView';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../services/supabaseClient';
import { profileStyles } from '../../styles/profileStyles';
import { getAvatarDisplay } from '../../utils/avatarUtils';
import AvatarDisplay from '../AvatarDisplay';

export function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [showProfile, setShowProfile] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingSystem, setUpdatingSystem] = useState(false);

  // Add state for avatar modal
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // Available avatars
  const avatarOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9];

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
            show_profile: metadata.showProfile !== undefined ? metadata.showProfile : true, // Default to true
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
        // Update user metadata to maintain name consistency
        const { error: updateError } = await supabase.auth.updateUser({
          data: { 
            displayName: trimmedName || null,
            showProfile: showProfile
          }
        });
        
        if (updateError) {
          console.warn('Failed to update auth metadata:', updateError);
        }
        
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
    
    setShowAvatarModal(true);
  };

  const handleAvatarSelect = async (avatarId: number) => {
    if (!user || !profile) return;
    
    try {
      setLoading(true);
      setShowAvatarModal(false);
      
      // Update profile with selected avatar ID
      await leaderboardService.updateUserProfile(user.id, {
        ...profile,
        avatar_url: String(avatarId)
      });

      // Reload profile
      await loadProfile();
    } catch (err) {
      console.error('Error updating avatar:', err);
      setError(err instanceof Error ? err : new Error('Failed to update avatar'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMeasurementSystem = async (useImperial: boolean) => {
    if (!profile || !user) return;
    
    // Prevent multiple simultaneous updates
    if (updatingSystem) return;
    
    try {
      setUpdatingSystem(true);
      const newSystem = useImperial ? 'imperial' : 'metric';
      
      // First update local state for immediate UI feedback
      setProfile(prevProfile => prevProfile ? {
        ...prevProfile,
        measurement_system: newSystem
      } : null);
      
      // Then update profile in database
      await leaderboardService.updateUserProfile(user.id, {
        ...profile,
        measurement_system: newSystem
      });
      
      // Update user metadata through Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        data: { measurementSystem: newSystem }
      });
      
      if (updateError) {
        console.warn('Failed to update auth metadata:', updateError);
      }
      
    } catch (err) {
      console.error('Error updating measurement system:', err);
      
      // Revert local state change on error
      setProfile(prevProfile => prevProfile ? {
        ...prevProfile,
        measurement_system: prevProfile.measurement_system // Revert to previous value
      } : null);
      
      setError(err instanceof Error ? err : new Error('Failed to update measurement system'));
    } finally {
      setUpdatingSystem(false);
    }
  };

  if (loading && !profile && !error) {
    return (
      <View style={profileStyles.centered}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  if (error) {
    return <ErrorView error={error} onRetry={loadProfile} />;
  }

  return (
    <ScrollView style={profileStyles.container} contentContainerStyle={profileStyles.contentContainer}>
      {/* Header */}
      <View style={profileStyles.header}>
        <Text style={profileStyles.headerTitle}>Profile</Text>
      </View>

      {/* Profile Card */}
      <View style={profileStyles.profileCard}>
        {/* Avatar Section */}
        <View style={profileStyles.avatarSection}>
          <Pressable style={profileStyles.avatarWrapper} onPress={handleAvatarUpdate} testID="avatar-button">
            {profile?.avatar_url ? (
              <AvatarDisplay 
                avatarId={profile.avatar_url}
                style={profileStyles.avatar}
                testID="profile-avatar-image"
              />
            ) : (
              <View style={profileStyles.avatarPlaceholder} testID="avatar-placeholder">
                <Text style={profileStyles.avatarText}>
                  {getAvatarDisplay(profile?.display_name, null).firstLetter}
                </Text>
              </View>
            )}
            <View style={profileStyles.editAvatarButton}>
              <MaterialCommunityIcons name="pencil" size={14} color="#ffffff" />
            </View>
          </Pressable>
        </View>

        {/* Name Section */}
        <View style={profileStyles.nameSection}>
          {editingName ? (
            <TextInput
              style={profileStyles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display Name"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
          ) : (
            <View style={profileStyles.displayNameContainer}>
              <Text style={profileStyles.displayName}>
                {displayName || 'Anonymous User'}
              </Text>
              <Pressable
                style={profileStyles.editNameButton}
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

        <Text style={profileStyles.email}>{user?.email}</Text>
      </View>

      {/* Settings Card */}
      <View style={profileStyles.settingsCard}>
        <View style={profileStyles.settingRow}>
          <Text style={profileStyles.settingLabel}>Show Profile Publicly</Text>
          <Switch
            value={showProfile}
            onValueChange={setShowProfile}
            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
            thumbColor={showProfile ? '#0284c7' : '#F3F4F6'}
          />
        </View>
        <View style={[profileStyles.settingRow, profileStyles.settingBorder]}>
          <Text style={profileStyles.settingLabel}>Use Imperial Units</Text>
          <Switch
            disabled={updatingSystem}
            value={profile?.measurement_system === 'imperial'}
            onValueChange={handleUpdateMeasurementSystem}
            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
            thumbColor={profile?.measurement_system === 'imperial' ? '#0284c7' : '#F3F4F6'}
          />
          {updatingSystem && (
            <ActivityIndicator 
              size="small" 
              color="#0284c7" 
              style={{ marginLeft: 8 }}
            />
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={profileStyles.buttonContainer}>
        <Pressable
          style={[profileStyles.saveButton, saving && profileStyles.buttonDisabled]}
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
                style={profileStyles.buttonIcon}
              />
              <Text style={profileStyles.buttonText}>Save Changes</Text>
            </>
          )}
        </Pressable>

        <Pressable style={profileStyles.signOutButton} onPress={handleSignOut}>
          <MaterialCommunityIcons
            name="logout"
            size={20}
            color="#FFF"
            style={profileStyles.buttonIcon}
          />
          <Text style={profileStyles.buttonText}>Sign Out</Text>
        </Pressable>
      </View>

      {/* Avatar Selection Modal */}
      <Modal
        visible={showAvatarModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={profileStyles.modalOverlay}>
          <View style={profileStyles.modalContent}>
            <View style={profileStyles.modalHeader}>
              <Text style={profileStyles.modalTitle}>Select Avatar</Text>
              <Pressable onPress={() => setShowAvatarModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#000" />
              </Pressable>
            </View>
            <FlatList
              data={avatarOptions}
              numColumns={3}
              keyExtractor={(item) => item.toString()}
              renderItem={({ item }) => (
                <Pressable
                  style={profileStyles.avatarOption}
                  onPress={() => handleAvatarSelect(item)}
                >
                  <AvatarDisplay
                    avatarId={String(item)}
                    style={profileStyles.avatarOptionImage}
                  />
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}