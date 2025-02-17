import { supabase } from './supabaseClient';
import { PostgrestResponse } from '@supabase/supabase-js';
import {
  LeaderboardEntry,
  DailyTotal,
  WeeklyTotal,
  UserProfile,
  LeaderboardTimeframe,
} from '@/src/types/leaderboard';
import { healthMetrics } from '@/src/config/healthMetrics';
import type { MetricType } from '@/src/types/metrics';
import type { DailyMetricScore } from '@/src/types/schemas';
import * as FileSystem from 'expo-file-system';
const calculateTotalPoints = (metrics: DailyMetricScore[]): number => {
  return metrics.reduce((total, metric) => {
    const config = healthMetrics[metric.metric_type];
    if (!config || typeof metric.value !== 'number') return total;

    if (metric.metric_type === 'heart_rate') {
      const targetValue = config.defaultGoal;
      const deviation = Math.abs(metric.value - targetValue);
      const points = Math.max(0, config.pointIncrement.maxPoints * (1 - deviation / 15));
      return total + Math.round(points);
    }

    const points = Math.floor(metric.value / config.pointIncrement.value);
    return total + Math.min(points, config.pointIncrement.maxPoints);
  }, 0);
};

// Helper function to get week start date
function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Set to Sunday
  return d.toISOString().split('T')[0];
}

export const leaderboardService = {
  subscribeToLeaderboard(
    date: string,
    timeframe: LeaderboardTimeframe,
    onUpdate: (entries: LeaderboardEntry[]) => void
  ) {
    console.log(`Setting up ${timeframe} leaderboard subscription for date:`, date);

    const table = timeframe === 'daily' ? 'daily_totals' : 'weekly_totals';
    const dateField = timeframe === 'daily' ? 'date' : 'week_start';
    const dateValue = timeframe === 'daily' ? date : getWeekStart(new Date(date));

    return supabase
      .channel(`${timeframe}-leaderboard-${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `${dateField}=eq.${dateValue}`,
        },
        async () => {
          // Fetch updated data when changes occur
          const entries =
            timeframe === 'daily'
              ? await this.getDailyLeaderboard(date)
              : await this.getWeeklyLeaderboard(date);
          onUpdate(entries);
        }
      )
      .subscribe(status => {
        console.log(`${timeframe} leaderboard subscription status:`, status);
      });
  },

  async getDailyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
    console.log('Fetching daily leaderboard for date:', date);

    try {
      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metric_scores')
        .select('user_id, metric_type, value')
        .eq('date', date);

      if (metricsError) throw metricsError;

      // Group metrics by user
      const userMetrics = new Map<string, DailyMetricScore[]>();
      metricsData?.forEach(metric => {
        const metrics = userMetrics.get(metric.user_id) || [];
        userMetrics.set(metric.user_id, [...metrics, metric as DailyMetricScore]);
      });

      // Calculate points using the same function as Dashboard
      const userPoints = new Map<string, { total: number; completed: number }>();
      userMetrics.forEach((metrics, userId) => {
        userPoints.set(userId, {
          total: calculateTotalPoints(metrics),
          completed: metrics.length,
        });
      });

      // Get user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url, show_profile');

      if (profilesError) throw profilesError;

      // Create leaderboard entries
      const entries = Array.from(userPoints.entries())
        .map(([userId, points], index) => {
          const profile = profiles?.find(p => p.id === userId);
          return {
            user_id: userId,
            display_name: profile?.display_name || `User ${userId.slice(0, 8)}`,
            avatar_url: profile?.avatar_url || null,
            total_points: points.total,
            metrics_completed: points.completed,
            rank: index + 1,
            show: profile?.show_profile !== false,
          };
        })
        .sort((a, b) => b.total_points - a.total_points)
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
        .filter(entry => entry.show);

      return entries;
    } catch (error) {
      console.error('Error in getDailyLeaderboard:', error);
      throw error;
    }
  },

  async getUserRank(userId: string, date: string): Promise<number | null> {
    try {
      const leaderboard = await this.getDailyLeaderboard(date);
      const userIndex = leaderboard.findIndex(entry => entry.user_id === userId);
      return userIndex === -1 ? null : userIndex + 1;
    } catch (error) {
      console.error('Error in getUserRank:', error);
      throw error;
    }
  },

  async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }

    return data;
  },

  async updateUserProfile(userId: string, profile: Partial<UserProfile>) {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        display_name: profile.display_name,
        show_profile: profile.show_profile,
        avatar_url: profile.avatar_url,
        device_type: profile.device_type,
        measurement_system: profile.measurement_system,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error('Error updating user profile:', error);
      throw error;
    } else {
      console.log('User profile updated successfully:', data);
    }

    return data;
  },

  mapMetadataToProfile(metadata: any): Partial<UserProfile> {
    return {
      display_name: metadata.displayName || null,
      avatar_url: metadata.avatarUri || null,
      device_type: metadata.deviceType || null,
      measurement_system: metadata.measurementSystem || 'metric',
    };
  },

  async uploadAvatar(userId: string, uri: string): Promise<string> {
    try {
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      // Check file size (limit to 5MB)
      if (fileInfo.size && fileInfo.size > 5 * 1024 * 1024) {
        throw new Error('File size exceeds 5MB limit');
      }

      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
          resolve(xhr.response);
        };
        xhr.onerror = () => {
          reject(new Error('Failed to convert file'));
        };
        xhr.responseType = 'blob';
        xhr.open('GET', `data:image/jpeg;base64,${base64}`, true);
        xhr.send(null);
      });

      // Determine file extension from URI
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage with proper content type
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload avatar: ${uploadError.message}`);
      }

      if (!uploadData) {
        throw new Error('Upload succeeded but no data returned');
      }

      // Get the public URL
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded avatar');
      }

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      if (error instanceof Error) {
        throw new Error(`Avatar upload failed: ${error.message}`);
      }
      throw new Error('Avatar upload failed with unknown error');
    }
  },

  async getWeeklyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
    console.log('Fetching weekly leaderboard for date:', date);
    const weekStart = getWeekStart(new Date(date));

    try {
      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metric_scores')
        .select('user_id, metric_type, value, date')
        .gte('date', weekStart)
        .lte('date', date);

      if (metricsError) throw metricsError;

      // Group metrics by user
      const userMetrics = new Map<string, DailyMetricScore[]>();
      metricsData?.forEach(metric => {
        const metrics = userMetrics.get(metric.user_id) || [];
        userMetrics.set(metric.user_id, [...metrics, metric as DailyMetricScore]);
      });

      // Calculate points using the same function as Dashboard
      const userPoints = new Map<string, { total: number; completed: number }>();
      userMetrics.forEach((metrics, userId) => {
        userPoints.set(userId, {
          total: calculateTotalPoints(metrics),
          completed: metrics.length,
        });
      });

      // Get user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url, show_profile');

      if (profilesError) throw profilesError;

      // Create leaderboard entries
      const entries = Array.from(userPoints.entries())
        .map(([userId, points], index) => {
          const profile = profiles?.find(p => p.id === userId);
          return {
            user_id: userId,
            display_name: profile?.display_name || `User ${userId.slice(0, 8)}`,
            avatar_url: profile?.avatar_url || null,
            total_points: points.total,
            metrics_completed: points.completed,
            rank: index + 1,
            show: profile?.show_profile !== false,
          };
        })
        .sort((a, b) => b.total_points - a.total_points)
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
        .filter(entry => entry.show);

      return entries;
    } catch (error) {
      console.error('Error in getWeeklyLeaderboard:', error);
      throw error;
    }
  },

  async getUserWeeklyRank(userId: string, date: string): Promise<number | null> {
    try {
      const leaderboard = await this.getWeeklyLeaderboard(date);
      const userIndex = leaderboard.findIndex(entry => entry.user_id === userId);
      return userIndex === -1 ? null : userIndex + 1;
    } catch (error) {
      console.error('Error in getUserWeeklyRank:', error);
      throw error;
    }
  },
};
