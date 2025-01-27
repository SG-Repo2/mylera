import { supabase } from './supabaseClient';

export type MetricType = 'steps' | 'distance' | 'calories';

interface MetricScore {
  user_id: string;
  date: string;
  metric_type: MetricType;
  goal_reached: boolean;
  points: number;
}

interface MetricUpdate {
  value: number;
  goal: number;
  type: MetricType;
}

export const metricsService = {
  async getDailyMetrics(userId: string, date: string) {
    const { data, error } = await supabase
      .from('daily_metric_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date);

    if (error) throw error;
    return data;
  },

  async updateMetric(userId: string, update: MetricUpdate) {
    const today = new Date().toISOString().split('T')[0];
    const goalReached = update.value >= update.goal;
    
    // Calculate points based on progress
    const progressPercentage = Math.min((update.value / update.goal) * 100, 100);
    const points = Math.floor(progressPercentage);

    const metricScore: MetricScore = {
      user_id: userId,
      date: today,
      metric_type: update.type,
      goal_reached: goalReached,
      points,
    };

    const { error } = await supabase
      .from('daily_metric_scores')
      .upsert(metricScore, {
        onConflict: 'user_id,date,metric_type'
      });

    if (error) throw error;

    // Update daily totals
    await this.updateDailyTotal(userId, today);
  },

  async updateDailyTotal(userId: string, date: string) {
    // Get all metrics for the day
    const { data: metrics, error: metricsError } = await supabase
      .from('daily_metric_scores')
      .select('points, goal_reached')
      .eq('user_id', userId)
      .eq('date', date);

    if (metricsError) throw metricsError;

    // Calculate totals
    const totalPoints = metrics?.reduce((sum, metric) => sum + metric.points, 0) ?? 0;
    const metricsCompleted = metrics?.filter(metric => metric.goal_reached).length ?? 0;

    // Update daily_totals
    const { error: updateError } = await supabase
      .from('daily_totals')
      .upsert({
        user_id: userId,
        date,
        total_points: totalPoints,
        metrics_completed: metricsCompleted,
      }, {
        onConflict: 'user_id,date'
      });

    if (updateError) throw updateError;
  },

  getMetricGoals(): Record<MetricType, number> {
    return {
      steps: 10000,
      distance: 5, // km
      calories: 2000,
    };
  },
};