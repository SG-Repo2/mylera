import { supabase } from './supabaseClient';
import { PostgrestResponse } from '@supabase/supabase-js';
import { 
  LeaderboardEntry, 
  DailyTotal, 
  UserProfile 
} from '@/src/types/leaderboard';

export const leaderboardService = {
  subscribeToLeaderboard(date: string, onUpdate: (entries: LeaderboardEntry[]) => void) {
    console.log('Setting up leaderboard subscription for date:', date);
    
    return supabase
      .channel(`leaderboard-${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_totals',
          filter: `date=eq.${date}`,
        },
        async () => {
          // Fetch updated data when changes occur
          const entries = await this.getDailyLeaderboard(date);
          onUpdate(entries);
        }
      )
      .subscribe((status) => {
        console.log('Leaderboard subscription status:', status);
      });
  },

  async getDailyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
    console.log('Fetching daily leaderboard for date:', date);
    
    try {
      // First try to get daily totals with user profiles
      const { data, error } = await supabase
        .from('daily_totals')
        .select(`
          user_id,
          total_points,
          metrics_completed,
          user_profiles (
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
      
      const leaderboard = data
        .filter(entry => {
          const showProfile = entry.user_profiles?.show_profile;
          if (!showProfile) {
            console.log(`Filtering out user ${entry.user_id} due to show_profile = false`);
          }
          return showProfile;
        })
        .map((entry, index): LeaderboardEntry => {
          const mappedEntry = {
            user_id: entry.user_id,
            display_name: entry.user_profiles?.display_name || 'Anonymous User',
            avatar_url: entry.user_profiles?.avatar_url || null,
            total_points: entry.total_points,
            metrics_completed: entry.metrics_completed,
            rank: index + 1,
          };
          console.log('Mapped leaderboard entry:', mappedEntry);
          return mappedEntry;
        });

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

  async updateUserProfile(userId: string, profile: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          ...profile,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error updating user profile:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in updateUserProfile:', error);
      throw error;
    }
  },

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      console.log('Fetching user profile for ID:', userId);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Handle "no rows returned" as a non-error case
        if (error.code === 'PGRST116') {
          console.log('No profile found for user:', userId);
          return null;
        }
        
        // Handle permission errors by returning null instead of throwing
        if (error.code === '42501') {
          console.warn('Permission denied for user profile access:', userId);
          return null;
        }
        
        console.error('Error fetching user profile:', error);
        throw error;
      }

      if (!data) {
        console.log('No profile data returned for user:', userId);
        return null;
      }

      console.log('Found user profile:', data);
      return data;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      throw error;
    }
  },
};