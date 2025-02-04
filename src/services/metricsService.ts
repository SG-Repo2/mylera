import { supabase } from './supabaseClient';
import type { MetricType} from '../types/schemas';
import { healthMetrics } from '../config/healthMetrics';

// Error class for authentication/authorization errors
class MetricsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsAuthError';
  }
}

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
    // Verify user is authenticated
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) {
      throw new MetricsAuthError('User must be authenticated to update metrics');
    }

    // Verify userId matches authenticated user
    if (session.data.session.user.id !== userId) {
      throw new MetricsAuthError('Cannot update metrics for another user');
    }

    const today = new Date().toISOString().split('T')[0];
    const config = healthMetrics[metricType];
    
    // Calculate points and goal status based on environment
    let goalReached = false;
    let points = 0;
    
    if (__DEV__) {
      // Development scoring: simplified scoring for easier testing
      goalReached = value > 0;
      points = goalReached ? 50 : 0;
    } else {
      // Production scoring
      goalReached = value >= config.defaultGoal;
      points = Math.min(Math.floor((value / config.defaultGoal) * 100), 100);
    }
    
    // Update metric score - always set is_test_data to false to comply with RLS policies
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
        is_test_data: false // Always false to avoid RLS policy violations
      }, {
        onConflict: 'user_id,date,metric_type'
      });
  
    if (metricError) {
      // Handle RLS policy violation
      if (metricError.code === '42501') {
        throw new MetricsAuthError('Permission denied: Cannot update metrics for this user');
      }
      throw metricError;
    }

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

    if (totalError) {
      // Handle RLS policy violation
      if (totalError.code === '42501') {
        throw new MetricsAuthError('Permission denied: Cannot update daily totals for this user');
      }
      throw totalError;
    }
  }
};
