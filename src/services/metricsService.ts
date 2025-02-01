import { supabase } from './supabaseClient';
import type { MetricType} from '../types/schemas';
import { healthMetrics } from '../config/healthMetrics';

export const metricsService = {
  // Get user's daily metrics
  async getDailyMetrics(userId: string, date: string) {
    const { data, error } = await supabase
      .from('daily_metric_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('is_test_data', false);

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
      .eq('is_test_data', false)
      .order('total_points', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Update a single metric
  async updateMetric(userId: string, metricType: MetricType, value: number) {
    const today = new Date().toISOString().split('T')[0];
    const config = healthMetrics[metricType];
    
    let goalReached = false;
    let points = 0;
    
    if (__DEV__) {
      // Development scoring: flat score for any positive value
      goalReached = value > 0;
      points = goalReached ? 50 : 0;
    } else {
      // Production scoring
      goalReached = value >= config.defaultGoal;
      points = Math.min(Math.floor((value / config.defaultGoal) * 100), 100);
    }
    
    // Update metric score with development flag for test data
    const { error: metricError } = await supabase
      .from('daily_metric_scores')
      .upsert({
        user_id: userId,
        date: today,
        metric_type: metricType,
        value,
        points,
        goal_reached: goalReached,
        updated_at: new Date().toISOString(),
        is_test_data: __DEV__
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
        updated_at: new Date().toISOString(),
        is_test_data: false
      }, {
        onConflict: 'user_id,date'
      });

    if (totalError) throw totalError;
  }
};
