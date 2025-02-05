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

  // Get user's historical metrics for the last 7 days
  async getHistoricalMetrics(userId: string, metricType: MetricType, endDate: string) {
    // Ensure we're working with local dates
    const endDateTime = new Date(endDate);
    const startDateTime = new Date(endDate);
    startDateTime.setDate(startDateTime.getDate() - 6); // Get 7 days including end date
    
    // Format dates in YYYY-MM-DD format using local timezone
    const startDateStr = startDateTime.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format
    const endDateStr = endDateTime.toLocaleDateString('en-CA');
    
    console.log('Date range:', { startDateStr, endDateStr });
    
    const { data, error } = await supabase
      .from('daily_metric_scores')
      .select('date, value')
      .eq('user_id', userId)
      .eq('metric_type', metricType)
      .eq('is_test_data', false)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    if (error) throw error;

    // Log the data for debugging
    console.log('Historical data for', metricType, ':', data);
    
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
