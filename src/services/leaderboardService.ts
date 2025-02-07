import { supabase } from './supabaseClient';
import { PostgrestResponse } from '@supabase/supabase-js';
import { 
  LeaderboardEntry, 
  DailyTotal,
  WeeklyTotal,
  UserProfile,
  LeaderboardTimeframe
} from '@/src/types/leaderboard';

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
      const { data, error } = await supabase
        .from('daily_totals')
        .select(`
          user_id,
          total_points,
          metrics_completed,
          user_profiles!left (
            id,
            display_name,
            avatar_url,
            show_profile
          )
        `)
        .eq('date', date)
        .order('total_points', { ascending: false }) as PostgrestResponse<DailyTotal>;

      if (error) {
        // If there's a foreign key or permission error, fall back to just daily_totals
        if (error.code === 'PGRST200' || error.code === '42501') {
          console.warn('Falling back to daily_totals only due to:', error.message);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('daily_totals')
            .select('user_id, total_points, metrics_completed')
            .eq('date', date)
            .order('total_points', { ascending: false });

          if (fallbackError) throw fallbackError;
          if (!fallbackData) return [];

          // Map fallback data without user profile information
          return fallbackData.map((entry, index) => ({
            user_id: entry.user_id,
            display_name: 'Anonymous User',
            avatar_url: null,
            total_points: entry.total_points,
            metrics_completed: entry.metrics_completed,
            rank: index + 1,
          }));
        }
        throw error;
      }
      
      if (!data) {
        console.log('No data returned from daily_totals query');
        return [];
      }

      console.log('Raw daily_totals data:', data);
      
      const leaderboard = (data || []).map((entry, index) => ({
        user_id: entry.user_id,
        display_name: entry.user_profiles?.display_name || `User ${entry.user_id.slice(0, 8)}`,
        avatar_url: entry.user_profiles?.avatar_url || null,
        total_points: entry.total_points,
        metrics_completed: entry.metrics_completed,
        rank: index + 1,
        show: entry.user_profiles?.show_profile !== false
      })).filter(entry => entry.show);

      console.log('Final leaderboard data:', leaderboard);
      return leaderboard;
    } catch (error) {
      console.error('Error in getDailyLeaderboard:', error);
      throw error;
    }
  },

  async getUserRank(userId: string, date: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('daily_totals')
        .select('user_id, total_points')
        .eq('date', date)
        .order('total_points', { ascending: false });

      if (error) {
        console.error('Error fetching user rank:', error);
        throw error;
      }
      
      if (!data) return null;

      const userIndex = data.findIndex(entry => entry.user_id === userId);
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
      // Convert URI to Blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Generate a unique filename
      const fileExt = uri.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  },

  async getWeeklyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
    console.log('Fetching weekly leaderboard for date:', date);
    const weekStart = getWeekStart(new Date(date));
    
    try {
      const { data, error } = await supabase
        .from('weekly_totals')
        .select(`
          user_id,
          total_points,
          metrics_completed,
          user_profiles!left (
            id,
            display_name,
            avatar_url,
            show_profile
          )
        `)
        .eq('week_start', weekStart)
        .eq('is_test_data', false)
        .order('total_points', { ascending: false }) as PostgrestResponse<WeeklyTotal>;

      if (error) {
        // If there's a foreign key or permission error, fall back to just weekly_totals
        if (error.code === 'PGRST200' || error.code === '42501') {
          console.warn('Falling back to weekly_totals only due to:', error.message);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('weekly_totals')
            .select('user_id, total_points, metrics_completed')
            .eq('week_start', weekStart)
            .eq('is_test_data', false)
            .order('total_points', { ascending: false });

          if (fallbackError) throw fallbackError;
          if (!fallbackData) return [];

          // Map fallback data without user profile information
          return fallbackData.map((entry, index) => ({
            user_id: entry.user_id,
            display_name: 'Anonymous User',
            avatar_url: null,
            total_points: entry.total_points,
            metrics_completed: entry.metrics_completed,
            rank: index + 1,
          }));
        }
        throw error;
      }
      
      if (!data) {
        console.log('No data returned from weekly_totals query');
        return [];
      }

      console.log('Raw weekly_totals data:', data);
      
      const leaderboard = (data || []).map((entry, index) => ({
        user_id: entry.user_id,
        display_name: entry.user_profiles?.display_name || `User ${entry.user_id.slice(0, 8)}`,
        avatar_url: entry.user_profiles?.avatar_url || null,
        total_points: entry.total_points,
        metrics_completed: entry.metrics_completed,
        rank: index + 1,
        show: entry.user_profiles?.show_profile !== false
      })).filter(entry => entry.show);

      console.log('Final weekly leaderboard data:', leaderboard);
      return leaderboard;
    } catch (error) {
      console.error('Error in getWeeklyLeaderboard:', error);
      throw error;
    }
  },

  async getUserWeeklyRank(userId: string, date: string): Promise<number | null> {
    try {
      const weekStart = getWeekStart(new Date(date));
      const { data, error } = await supabase
        .from('weekly_totals')
        .select('user_id, total_points')
        .eq('week_start', weekStart)
        .eq('is_test_data', false)
        .order('total_points', { ascending: false });

      if (error) {
        console.error('Error fetching user weekly rank:', error);
        throw error;
      }
      
      if (!data) return null;

      const userIndex = data.findIndex(entry => entry.user_id === userId);
      return userIndex === -1 ? null : userIndex + 1;
    } catch (error) {
      console.error('Error in getUserWeeklyRank:', error);
      throw error;
    }
  },
};
