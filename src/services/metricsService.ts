import { supabase } from './supabaseClient';
import { PostgrestResponse } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  MetricType,
  MetricUpdate,
  MetricGoals,
  DailyMetricScore,
  MetricUpdateSchema,
  DailyMetricScoreSchema,
  MetricGoalsSchema,
  MetricValidationError
} from '@/src/types/schemas';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async <T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = INITIAL_RETRY_DELAY
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (retries === 0 || error instanceof MetricValidationError) {
      throw error;
    }
    await wait(delay);
    return withRetry(operation, retries - 1, delay * 2);
  }
};

export const metricsService = {
  async getDailyMetrics(userId: string, date: string): Promise<DailyMetricScore[]> {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('daily_metric_scores')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date) as PostgrestResponse<DailyMetricScore>;

      if (error) throw error;

      // Validate response data
      const validationResult = z.array(DailyMetricScoreSchema).safeParse(data);
      if (!validationResult.success) {
        throw new MetricValidationError(
          'Invalid metric data received from server',
          validationResult.error.errors
        );
      }

      return validationResult.data;
    });
  },

  calculateMetricScore(value: number, goal: number): { points: number; goalReached: boolean } {
    // Ensure non-negative values and prevent division by zero
    const normalizedValue = Math.max(0, value);
    const normalizedGoal = Math.max(1, goal);
    
    const goalReached = normalizedValue >= normalizedGoal;
    const progressPercentage = Math.min((normalizedValue / normalizedGoal) * 100, 100);
    const basePoints = Math.floor(progressPercentage);
    
    // Bonus points for exceeding goals (up to 50% extra)
    const bonusPoints = goalReached
      ? Math.floor((normalizedValue - normalizedGoal) / normalizedGoal * 20)
      : 0;
    
    // Cap total points at 150
    const totalPoints = Math.min(basePoints + bonusPoints, 150);
    
    return { points: totalPoints, goalReached };
  },

  async updateMetric(userId: string, update: MetricUpdate): Promise<void> {
    return withRetry(async () => {
      try {
        // Validate input using Zod schema
        const validationResult = MetricUpdateSchema.safeParse(update);
        if (!validationResult.success) {
          throw new MetricValidationError(
            'Invalid metric update parameters',
            validationResult.error.errors
          );
        }

        const today = new Date().toISOString().split('T')[0];
        const { points, goalReached } = this.calculateMetricScore(update.value, update.goal);

        const metricScore: Partial<DailyMetricScore> = {
          user_id: userId,
          date: today,
          metric_type: update.type,
          goal_reached: goalReached,
          points,
          value: update.value,
          goal: update.goal,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('daily_metric_scores')
          .upsert(metricScore, {
            onConflict: 'user_id,date,metric_type'
          });

        if (error) {
          throw error;
        }

        // Update daily totals
        await this.updateDailyTotal(userId, today);
      } catch (error) {
        if (error instanceof MetricValidationError) {
          throw error;
        }
        console.error('Error in updateMetric:', error);
        throw error;
      }
    });
  },

  async updateDailyTotal(userId: string, date: string): Promise<void> {
    return withRetry(async () => {
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
    });
  },

  getMetricGoals(): MetricGoals {
    const goals = {
      steps: { defaultGoal: 10000, unit: 'steps' },
      distance: { defaultGoal: 5, unit: 'km' },
      calories: { defaultGoal: 2000, unit: 'kcal' },
      heart_rate: { defaultGoal: 120, unit: 'bpm' },
      exercise: { defaultGoal: 30, unit: 'min' },
      standing: { defaultGoal: 12, unit: 'hr' }
    };

    // Validate goals against schema
    const validationResult = MetricGoalsSchema.safeParse(goals);
    if (!validationResult.success) {
      throw new MetricValidationError(
        'Invalid metric goals configuration',
        validationResult.error.errors
      );
    }

    return validationResult.data;
  },
};