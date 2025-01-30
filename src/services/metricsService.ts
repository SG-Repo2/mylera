import { supabase } from './supabaseClient';
import type { MetricType } from '../types/schemas';
import { healthMetrics } from '../config/healthMetrics';

export const metricsService = {
  // Get user's daily metrics
  async getDailyMetrics(userId: string, date: string) {
    const { data, error } = await supabase
      .from('daily_metric_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date);

    if (error) throw error;
    return data || [];
  },

  // Get daily totals for leaderboard
  async getDailyTotals(date: string) {
    const { data, error } = await supabase
      .from('daily_totals')
      .select(`
        *,
        user_profiles (
          display_name,
          avatar_url,
          show_profile
        )
      `)
      .eq('date', date)
      .order('total_points', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Update a single metric
  async updateMetric(userId: string, metricType: MetricType, value: number) {
    const today = new Date().toISOString().split('T')[0];
    const config = healthMetrics[metricType];
    
    if (!config) return;

    // Calculate if goal was reached and points
    const goalReached = value >= config.defaultGoal;
    const points = Math.min(Math.floor((value / config.defaultGoal) * 100), 100);

    // Update metric score
    const { error: metricError } = await supabase
      .from('daily_metric_scores')
      .upsert({
        user_id: userId,
        date: today,
        metric_type: metricType,
        points,
        goal_reached: goalReached,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date,metric_type'
      });

    if (metricError) throw metricError;

    // Update daily total
    const { data: metrics } = await supabase
      .from('daily_metric_scores')
      .select('points, goal_reached')
      .eq('user_id', userId)
      .eq('date', today);

    const totalPoints = metrics?.reduce((sum, m) => sum + m.points, 0) ?? 0;
    const metricsCompleted = metrics?.filter(m => m.goal_reached).length ?? 0;

    const { error: totalError } = await supabase
      .from('daily_totals')
      .upsert({
        user_id: userId,
        date: today,
        total_points: totalPoints,
        metrics_completed: metricsCompleted,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date'
      });

    if (totalError) throw totalError;
  }
};