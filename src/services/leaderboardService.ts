import { supabase } from './supabaseClient';
import { Platform } from 'react-native';
import { UserProfile, LeaderboardEntry } from '../types/leaderboard';

// Types for Supabase responses
type DailyTotalWithProfile = {
  id: string;
  user_id: string;
  total_points: number;
  metrics_completed: number;
  rank: number;
  user_profiles: {
    display_name: string | null;
      avatar_url: string | null;
  } | null;
};

type WeeklyTotalWithProfile = {
  id: string;
  user_id: string;
  total_points: number;
  metrics_completed: number;
  user_profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

/**
 * Service for handling leaderboard-related operations
 */
export const leaderboardService = {
  /**
   * Get a user's profile information
   * @param userId The user's ID
   * @returns The user's profile data or null if not found
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      console.log('[LeaderboardService] Getting profile for user:', userId);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[LeaderboardService] Profile fetch error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[LeaderboardService] Failed to get user profile:', error);
      throw error;
    }
  },

  /**
   * Update a user's profile information
   * @param userId The user's ID
   * @param profile The profile data to update
   */
  async updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<void> {
    try {
      console.log('[LeaderboardService] Updating profile for user:', userId);
      const { error } = await supabase
        .from('user_profiles')
        .update(profile)
        .eq('id', userId);

      if (error) {
        console.error('[LeaderboardService] Profile update error:', error);
        throw error;
      }
    } catch (error) {
      console.error('[LeaderboardService] Failed to update user profile:', error);
      throw error;
    }
  },

  /**
   * Get the daily leaderboard for a specific date
   * @param date The date to get the leaderboard for (YYYY-MM-DD)
   * @returns Array of leaderboard entries
   */
  async getDailyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
    try {
      console.log('[LeaderboardService] Getting daily leaderboard for:', date);
      const { data, error } = await supabase
        .from('daily_totals_with_rank')
        .select(`
          id,
          user_id,
          total_points,
          metrics_completed,
          rank,
          user_profiles (
            display_name,
            avatar_url
          )
        `)
        .eq('date', date)
        .order('total_points', { ascending: false });

      if (error) {
        console.error('[LeaderboardService] Daily leaderboard fetch error:', error);
        throw error;
      }

      return (data as unknown as DailyTotalWithProfile[]).map(entry => ({
        id: entry.id,
        user_id: entry.user_id,
        display_name: entry.user_profiles?.display_name || 'Anonymous User',
        avatar_url: entry.user_profiles?.avatar_url || null,
        total_points: entry.total_points,
        metrics_completed: entry.metrics_completed,
        rank: entry.rank
      }));
    } catch (error) {
      console.error('[LeaderboardService] Failed to get daily leaderboard:', error);
      throw error;
    }
  },

  /**
   * Get the weekly leaderboard for a specific date
   * @param date Any date within the week to get the leaderboard for (YYYY-MM-DD)
   * @returns Array of leaderboard entries
   */
  async getWeeklyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
    try {
      console.log('[LeaderboardService] Getting weekly leaderboard for week of:', date);
      const { data, error } = await supabase
        .rpc('get_week_start', { date_input: date })
        .single();

      if (error) {
        console.error('[LeaderboardService] Week start calculation error:', error);
        throw error;
      }

      const weekStart = data;
      
      const { data: entries, error: fetchError } = await supabase
        .from('weekly_totals')
        .select(`
          id,
          user_id,
          total_points,
          metrics_completed,
          user_profiles (
            display_name,
            avatar_url
          )
        `)
        .eq('week_start', weekStart)
        .order('total_points', { ascending: false });

      if (fetchError) {
        console.error('[LeaderboardService] Weekly leaderboard fetch error:', fetchError);
        throw fetchError;
      }

      return (entries as unknown as WeeklyTotalWithProfile[]).map((entry, index) => ({
        id: entry.id,
        user_id: entry.user_id,
        display_name: entry.user_profiles?.display_name || 'Anonymous User',
        avatar_url: entry.user_profiles?.avatar_url || null,
        total_points: entry.total_points,
        metrics_completed: entry.metrics_completed,
        rank: index + 1
      }));
    } catch (error) {
      console.error('[LeaderboardService] Failed to get weekly leaderboard:', error);
      throw error;
    }
  },

  /**
   * Upload an avatar image for a user
   * @param userId The user's ID
   * @param uri The local URI of the image
   * @returns The public URL of the uploaded image
   */
  async uploadAvatar(userId: string, uri: string): Promise<string> {
    let blob: Blob | null = null;
    let filePath: string | null = null;

    try {
      console.log('[LeaderboardService] Starting avatar upload for user:', userId);

      // Validate input
      if (!uri) throw new Error('Invalid image URI provided');

      // Fetch the image data with timeout
      console.log('[LeaderboardService] Fetching image from URI:', uri);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(uri, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch image data: ${response.status} ${response.statusText}`);
      }

      // Create and validate blob
      blob = await response.blob();
      console.log('[LeaderboardService] Blob created:', {
        size: blob.size,
        type: blob.type
      });

      // Generate unique filename
      const extension = blob.type.split('/')[1] || 'jpg';
      const filename = `${userId}-${Date.now()}.${extension}`;
      filePath = `avatars/${filename}`;

      // Upload to Supabase storage
      console.log('[LeaderboardService] Uploading to Supabase:', filePath);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: blob.type,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded avatar');
      }

      console.log('[LeaderboardService] Upload successful:', urlData.publicUrl);
      return urlData.publicUrl;

    } catch (error) {
      console.error('[LeaderboardService] Avatar upload failed:', error);
      throw error;
    } finally {
      // Cleanup
      blob = null;
    }
  },

  /**
   * Delete an avatar image
   * @param filePath The path of the file in storage
   */
  async deleteAvatar(filePath: string): Promise<void> {
    try {
      console.log('[LeaderboardService] Deleting avatar:', filePath);
      const { error } = await supabase.storage
        .from('avatars')
        .remove([filePath]);

      if (error) {
        console.error('[LeaderboardService] Delete error:', error);
        throw error;
      }

      console.log('[LeaderboardService] Avatar deleted successfully');
    } catch (error) {
      console.error('[LeaderboardService] Avatar deletion failed:', error);
      throw error;
    }
  },

  /**
   * Get the file path from a public URL
   * @param url The public URL of the file
   * @returns The file path in storage
   */
  getFilePathFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Extract the path after /avatars/
      const matches = urlObj.pathname.match(/\/avatars\/(.+)$/);
      if (!matches) {
        throw new Error('Invalid avatar URL format');
      }
      return `avatars/${matches[1]}`;
    } catch (error) {
      console.error('[LeaderboardService] Failed to parse avatar URL:', error);
      throw error;
    }
  },

  async getUserRank(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('daily_totals')
        .select('user_id, total_points')
        .order('total_points', { ascending: false });

      if (error) throw error;

      const userIndex = data.findIndex(row => row.user_id === userId);
      return userIndex === -1 ? 0 : userIndex + 1;
    } catch (error) {
      console.error('[LeaderboardService] Error getting user rank:', error);
      return 0;
    }
  }
};
