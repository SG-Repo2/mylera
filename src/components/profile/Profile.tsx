import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, TextInput, Pressable, ActivityIndicator, Switch, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [showProfile, setShowProfile] = useState(false);

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
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load profile'));
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
      await leaderboardService.updateUserProfile(user.id, {
        display_name: displayName.trim() || null,
        show_profile: showProfile,
      });
      await loadProfile(); // Reload to confirm changes
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update profile'));
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
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" className="text-sky-600" />
      </View>
    );
  }

  if (error) {
    return (
      <ErrorView 
        message={error.message} 
        onRetry={loadProfile}
      />
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-5 pt-8 pb-6">
        <Text className="text-2xl font-bold text-gray-900">Profile</Text>
      </View>

      {/* Profile Content */}
      <View className="px-5 space-y-6">
        {/* Avatar + Basic Info */}
        <View className="items-center">
          {profile?.avatar_url ? (
            <Image 
              source={{ uri: profile.avatar_url }} 
              className="w-24 h-24 rounded-full mb-4"
            />
          ) : (
            <View className="w-24 h-24 rounded-full bg-gray-300 items-center justify-center mb-4">
              <Text className="text-3xl font-bold text-white">
                {displayName?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
          )}

          <TextInput
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display Name"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Show Profile Toggle */}
        <View className="flex-row justify-between items-center bg-white p-4 rounded-lg">
          <Text className="text-base text-gray-700">Show Profile Publicly</Text>
          <Switch
            value={showProfile}
            onValueChange={setShowProfile}
            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
            thumbColor={showProfile ? '#0284c7' : '#F3F4F6'}
          />
        </View>

        {/* Save Button */}
        <Pressable 
          onPress={handleSaveProfile}
          disabled={saving}
          className="bg-sky-600 rounded-lg p-4 flex-row justify-center items-center"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="save" size={20} color="white" className="mr-2" />
              <Text className="text-white font-semibold text-base">Save Changes</Text>
            </>
          )}
        </Pressable>

        <View className="h-px bg-gray-200 my-2" />

        {/* Sign Out */}
        <Pressable 
          onPress={handleSignOut}
          className="bg-red-500 rounded-lg p-4 flex-row justify-center items-center"
        >
          <MaterialIcons name="logout" size={20} color="white" className="mr-2" />
          <Text className="text-white font-semibold text-base">Sign Out</Text>
        </Pressable>

        {/* Bottom Padding */}
        <View className="h-5" />
      </View>
    </ScrollView>
  );
}