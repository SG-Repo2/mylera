import { supabase } from './supabaseClient';
import { PostgrestResponse } from '@supabase/supabase-js';
import { 
  MetricType, 
  DailyMetricScore, 
  MetricUpdate,
  MetricGoals 
} from '@/src/types/metrics';

export const metricsService = {
  async getDailyMetrics(userId: string, date: string): Promise<DailyMetricScore[]> {
    const { data, error } = await supabase
      .from('daily_metric_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date) as PostgrestResponse<DailyMetricScore>;

    if (error) throw error;
    return data || [];
  },

  async updateMetric(userId: string, update: MetricUpdate): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const goalReached = update.value >= update.goal;
    
    const progressPercentage = Math.min((update.value / update.goal) * 100, 100);
    const points = Math.floor(progressPercentage);

    const metricScore: Partial<DailyMetricScore> = {
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
    await this.updateDailyTotal(userId, today);
  },

  async updateDailyTotal(userId: string, date: string): Promise<void> {
    const { data: metrics, error: metricsError } = await supabase
      .from('daily_metric_scores')
      .select('points, goal_reached')
      .eq('user_id', userId)
      .eq('date', date);

    if (metricsError) throw metricsError;

    const totalPoints = metrics?.reduce((sum, metric) => sum + metric.points, 0) ?? 0;
    const metricsCompleted = metrics?.filter(metric => metric.goal_reached).length ?? 0;

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

  getMetricGoals(): MetricGoals {
    return {
      steps: { defaultGoal: 10000, unit: 'steps' },
      distance: { defaultGoal: 5, unit: 'km' },
      calories: { defaultGoal: 2000, unit: 'kcal' },
      heart_rate: { defaultGoal: 120, unit: 'bpm' },
      exercise: { defaultGoal: 30, unit: 'min' },
      standing: { defaultGoal: 12, unit: 'hr' }
    };
  },
};