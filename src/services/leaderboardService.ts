import { supabase } from './supabaseClient';
import { PostgrestResponse } from '@supabase/supabase-js';
import { 
  LeaderboardEntry, 
  DailyTotal,
  WeeklyTotal,
  UserProfile,
  LeaderboardTimeframe
} from '@/src/types/leaderboard';
import { healthMetrics } from '@/src/config/healthMetrics';
import type { MetricType } from '@/src/types/metrics';
import type { DailyMetricScore } from '@/src/types/schemas';
import { calculateTotalPoints } from '@/src/utils/pointsCalculator';

// Helper function to get week start date
function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Set to Sunday
  return d.toISOString().split('T')[0];
}

export const leaderboardService = {
  subscribeToLeaderboard(date: string, timeframe: LeaderboardTimeframe, onUpdate: (entries: LeaderboardEntry[]) => void) {
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
          const entries = timeframe === 'daily' 
            ? await this.getDailyLeaderboard(date)
            : await this.getWeeklyLeaderboard(date);
          onUpdate(entries);
        }
      )
      .subscribe((status) => {
        console.log(`${timeframe} leaderboard subscription status:`, status);
      });
  },

  async getDailyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
    console.log('Fetching daily leaderboard for date:', date);
    
    try {
      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metric_scores')
        .select('user_id, metric_type, value, points')
        .eq('date', date);

      if (metricsError) throw metricsError;

      // Group metrics by user
      const userMetrics = new Map<string, DailyMetricScore[]>();
      metricsData?.forEach(metric => {
        const metrics = userMetrics.get(metric.user_id) || [];
        userMetrics.set(metric.user_id, [...metrics, metric as DailyMetricScore]);
      });

      
      // Calculate points using the same function as Dashboard
      const userPoints = new Map<string, { total: number, completed: number }>();
      userMetrics.forEach((metrics, userId) => {
        userPoints.set(userId, {
          total: calculateTotalPoints(metrics, 'leaderboardService.getDailyLeaderboard'),
          completed: metrics.length
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
            show: profile?.show_profile !== false
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
      
      // If profile not found, try to create one from auth metadata
      if (error.code === 'PGRST116') { // Record not found
        try {
          // Get user metadata from auth
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            const metadata = userData.user.user_metadata;
            const defaultProfile = this.mapMetadataToProfile(metadata);
            
            // Create profile from metadata
            await this.updateUserProfile(userId, defaultProfile);
            
            // Return the newly created profile
            return {
              id: userId,
              ...defaultProfile,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          }
        } catch (createError) {
          console.error('Error creating profile from metadata:', createError);
        }
      }
      
      throw error;
    }

    return data;
  },

  async updateUserProfile(userId: string, profile: Partial<UserProfile>) {
    // Ensure we have a valid display name
    const displayName = profile.display_name?.trim() || null;
    
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        display_name: displayName,
        show_profile: profile.show_profile,
        avatar_url: profile.avatar_url,
        device_type: profile.device_type,
        measurement_system: profile.measurement_system,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      throw error;
    } else {
      console.log('User profile updated successfully:', data);
      
      // Also update the auth metadata to keep display name in sync
      try {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { 
            displayName: displayName 
          }
        });
        
        if (metadataError) {
          console.warn('Failed to update auth metadata with display name:', metadataError);
        }
      } catch (metadataUpdateError) {
        console.warn('Error updating auth metadata:', metadataUpdateError);
        // Don't throw - this is a non-critical update
      }
    }

    return data;
  },

  mapMetadataToProfile(metadata: any): Partial<UserProfile> {
    return {
      display_name: metadata.displayName || null,
      avatar_url: metadata.avatarUri || null,
      device_type: metadata.deviceType || null,
      measurement_system: metadata.measurementSystem || 'metric',
      show_profile: metadata.showProfile !== undefined ? metadata.showProfile : true,
    };
  },

  async createUserProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile | null> {
    console.log(`[leaderboardService] Creating profile for user ${userId}:`, profile);
    
    // Ensure we have a valid display name
    const displayName = profile.display_name?.trim() || null;
    
    try {
      // Check if profile already exists
      const { data: existing, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
        
      if (checkError && checkError.code !== 'PGRST116') { // Not found error is ok
        console.error('[leaderboardService] Error checking for existing profile:', checkError);
        throw checkError;
      }
      
      // If profile already exists, update it
      if (existing) {
        console.log('[leaderboardService] Profile already exists, updating instead');
        return this.updateUserProfile(userId, profile);
      }
      
      // Create minimal required fields for new profile
      const newProfile = {
        id: userId,
        display_name: displayName,
        // Use defaults for other fields to reduce chance of errors
        show_profile: true,
        device_type: 'os',
        measurement_system: 'metric',
        avatar_url: null as string | null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Override defaults with provided values
      if (profile.show_profile !== undefined) newProfile.show_profile = profile.show_profile;
      if (profile.device_type) newProfile.device_type = profile.device_type;
      if (profile.measurement_system) newProfile.measurement_system = profile.measurement_system;
      if (profile.avatar_url) newProfile.avatar_url = profile.avatar_url;
      
      // Create the profile
      const { data, error } = await supabase
        .from('user_profiles')
        .insert(newProfile)
        .select('*')
        .single();
      
      if (error) {
        console.error('[leaderboardService] Error creating user profile:', error);
        throw error;
      }
      
      console.log('[leaderboardService] Profile created successfully:', data);
      return data;
    } catch (error) {
      console.error('[leaderboardService] Error in createUserProfile:', error);
      throw error;
    }
  },

  async uploadAvatar(userId: string, uri: string): Promise<string> {
    try {
      // Convert URI to Blob with explicit type
      const response = await fetch(uri);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      if (!blob) throw new Error('Failed to create blob from image');
      
      // Generate a unique filename with fallback extension
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: blob.type || 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      if (!uploadData) {
        throw new Error('Upload succeeded but no data returned');
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded avatar');
      }

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  },

  async getWeeklyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
    console.log('Fetching weekly leaderboard for date:', date);
    const weekStart = getWeekStart(new Date(date));
    
    try {
      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metric_scores')
        .select('user_id, metric_type, value, points, date')
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
      const userPoints = new Map<string, { total: number, completed: number }>();
      userMetrics.forEach((metrics, userId) => {
        userPoints.set(userId, {
          total: calculateTotalPoints(metrics, 'leaderboardService.getWeeklyLeaderboard'),
          completed: metrics.length
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
            show: profile?.show_profile !== false
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
