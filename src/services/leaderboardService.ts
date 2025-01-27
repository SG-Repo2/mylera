import { supabase } from './supabaseClient';
import { PostgrestResponse } from '@supabase/supabase-js';
import { 
  LeaderboardEntry, 
  DailyTotal, 
  UserProfile 
} from '@/src/types/leaderboard';


export const leaderboardService = {
  async getDailyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
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

    if (error) throw error;
    if (!data) return [];

    const leaderboard = data
      .filter(entry => entry.user_profiles?.show_profile)
      .map((entry, index): LeaderboardEntry => ({
        user_id: entry.user_id,
        display_name: entry.user_profiles?.display_name || 'Anonymous User',
        avatar_url: entry.user_profiles?.avatar_url || null,
        total_points: entry.total_points,
        metrics_completed: entry.metrics_completed,
        rank: index + 1,
      }));

    return leaderboard;
  },

  async getUserRank(userId: string, date: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('daily_totals')
      .select('user_id, total_points')
      .eq('date', date)
      .order('total_points', { ascending: false });

    if (error) throw error;
    if (!data) return null;

    const userIndex = data.findIndex(entry => entry.user_id === userId);
    return userIndex === -1 ? null : userIndex + 1;
  },

  async updateUserProfile(userId: string, profile: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>) {
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        ...profile,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
  },

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')  // Changed to select all fields since we have the full type
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
};