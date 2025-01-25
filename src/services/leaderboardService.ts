import { supabase } from './supabaseClient';
import { PostgrestResponse } from '@supabase/supabase-js';

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  metrics_completed: number;
  rank: number;
}

interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
  show_profile: boolean;
}

interface DailyTotal {
  user_id: string;
  total_points: number;
  metrics_completed: number;
  user_profiles: UserProfile | null;
}

export const leaderboardService = {
  async getDailyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from('daily_totals')
      .select(`
        user_id,
        total_points,
        metrics_completed,
        user_profiles (
          display_name,
          avatar_url,
          show_profile
        )
      `)
      .eq('date', date)
      .order('total_points', { ascending: false }) as PostgrestResponse<DailyTotal>;

    if (error) throw error;
    if (!data) return [];

    // Filter out users who don't want to show their profile
    // and format the response
    const leaderboard = data
      .filter(entry => entry.user_profiles?.show_profile)
      .map((entry, index) => ({
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

  async updateUserProfile(userId: string, profile: {
    display_name?: string;
    avatar_url?: string;
    show_profile?: boolean;
  }) {
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
      .select('display_name, avatar_url, show_profile')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
    return data;
  },
};