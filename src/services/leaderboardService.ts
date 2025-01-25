import { supabase } from './supabaseClient';

export async function getLeaderboard(date = new Date().toISOString().split('T')[0]) {
  // Only showing daily totals for the given date
  const { data, error } = await supabase
    .from('daily_totals')
    .select(`
      user_id,
      total_points,
      user_profiles (
        display_name,
        avatar_url,
        show_profile
      )
    `)
    .eq('date', date)
    .order('total_points', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}