import { supabase } from './supabaseClient';
import type { MetricType } from '../types/schemas';
import { healthMetrics } from '../config/healthMetrics';
import { calculatePoints, isValidMetricValue, calculateHealthScore } from '../utils/healthMetricUtils';
import {logger, LogCategory} from '@/src/utils/logger'
import { DateUtils } from '../utils/DateUtils';

// Cache for user measurement system preferences
const measurementSystemCache = new Map<string, string>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Error class for authentication/authorization errors
class MetricsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsAuthError';
  }
}

// Error class for validation errors
class MetricsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsValidationError';
  }
}

// Error class for database errors
class MetricsDatabaseError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'MetricsDatabaseError';
  }
}

/**
 * Service responsible for interacting with metrics data in the database.
 * Handles fetching, updating, and aggregating health metrics.
 */
export const metricsService = {
  /**
   * Get user's daily metrics for a specific date
   * @param userId - The user's ID
   * @param date - The date in YYYY-MM-DD format
   * @returns Array of daily metric records
   */
  async getDailyMetrics(userId: string, date: string) {
    try {
      logger.debug(LogCategory.Metrics, 'Getting daily metrics', undefined, undefined, { userId, date });
      
      const { data, error } = await supabase
        .from('daily_metric_scores')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .eq('is_test_data', false);

      if (error) {
        logger.error(LogCategory.Metrics, 'Error fetching daily metrics', error.message);
        throw new MetricsDatabaseError(
          `Failed to fetch daily metrics: ${error.message}`,
          error.code
        );
      }
      
      logger.debug(LogCategory.Metrics, 'Retrieved daily metrics', undefined, undefined, { count: data?.length || 0 });
      return data || [];
    } catch (error) {
      if (error instanceof MetricsDatabaseError) {
        throw error;
      }
      throw new Error(`Failed to get daily metrics: ${error}`);
    }
  },

  /**
   * Get user's historical metrics for a given time period
   * @param userId - The user's ID
   * @param metricType - The type of metric to fetch
   * @param endDate - The end date in YYYY-MM-DD format
   * @param days - Number of days to look back (default: 7)
   * @returns Array of metric records with date and value
   */
  async getHistoricalMetrics(
    userId: string, 
    metricType: MetricType, 
    endDate: string,
    days: number = 7
  ) {
    try {
      // Ensure we're working with local dates
      const endDateTime = new Date(endDate);
      const startDateTime = new Date(endDate);
      startDateTime.setDate(startDateTime.getDate() - (days - 1)); // Get N days including end date
      
      // Format dates in YYYY-MM-DD format using local timezone
      const startDateStr = DateUtils.getLocalDateString(startDateTime);
      const endDateStr = DateUtils.getLocalDateString(endDateTime);
      
      logger.debug(LogCategory.Metrics, 'Getting historical metrics', undefined, undefined, { 
        userId, 
        metricType, 
        startDate: startDateStr, 
        endDate: endDateStr 
      });
      
      const { data, error } = await supabase
        .from('daily_metric_scores')
        .select('date, value, goal_reached, points')
        .eq('user_id', userId)
        .eq('metric_type', metricType)
        .eq('is_test_data', false)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true });

      if (error) {
        logger.error(LogCategory.Metrics, 'Error fetching historical metrics', error.message);
        throw new MetricsDatabaseError(
          `Failed to fetch historical metrics: ${error.message}`,
          error.code
        );
      }
      
      logger.debug(LogCategory.Metrics, 'Retrieved historical metrics', undefined, undefined, { 
        metricType, 
        count: data?.length || 0 
      });
      
      return data || [];
    } catch (error) {
      if (error instanceof MetricsDatabaseError) {
        throw error;
      }
      throw new Error(`Failed to get historical metrics: ${error}`);
    }
  },

  /**
   * Get daily totals for the leaderboard
   * @param date - The date in YYYY-MM-DD format
   * @returns Array of daily totals with user profile information
   */
  async getDailyTotals(date: string) {
    try {
      logger.debug(LogCategory.Metrics, 'Getting daily totals for leaderboard', undefined, undefined, { date });
      
      const { data, error } = await supabase
        .from('daily_totals')
        .select(`
          id,
          user_id,
          date,
          total_points,
          metrics_completed,
          created_at,
          updated_at,
          user_profiles (
            display_name,
            avatar_url,
            show_profile
          )
        `)
        .eq('date', date)
        .eq('is_test_data', false)
        .order('total_points', { ascending: false });

      if (error) {
        logger.error(LogCategory.Metrics, 'Error fetching daily totals', error.message);
        throw new MetricsDatabaseError(
          `Failed to fetch daily totals: ${error.message}`,
          error.code
        );
      }
      
      logger.debug(LogCategory.Metrics, 'Retrieved daily totals', undefined, undefined, { count: data?.length || 0 });
      return data || [];
    } catch (error) {
      if (error instanceof MetricsDatabaseError) {
        throw error;
      }
      throw new Error(`Failed to get daily totals: ${error}`);
    }
  },

  /**
   * Get the weekly leaderboard for a specific week
   * @param weekStart - The week start date in YYYY-MM-DD format
   * @returns Array of weekly totals with user profile information
   */
  async getWeeklyLeaderboard(weekStart: string) {
    try {
      logger.debug(LogCategory.Metrics, 'Getting weekly leaderboard', undefined, undefined, { weekStart });
      
      const { data, error } = await supabase
        .from('weekly_totals')
        .select(`
          id,
          user_id,
          week_start,
          total_points,
          metrics_completed,
          created_at,
          updated_at,
          user_profiles (
            display_name,
            avatar_url,
            show_profile
          )
        `)
        .eq('week_start', weekStart)
        .order('total_points', { ascending: false });

      if (error) {
        logger.error(LogCategory.Metrics, 'Error fetching weekly leaderboard', error.message);
        throw new MetricsDatabaseError(
          `Failed to fetch weekly leaderboard: ${error.message}`,
          error.code
        );
      }
      
      logger.debug(LogCategory.Metrics, 'Retrieved weekly leaderboard', undefined, undefined, { count: data?.length || 0 });
      return data || [];
    } catch (error) {
      if (error instanceof MetricsDatabaseError) {
        throw error;
      }
      throw new Error(`Failed to get weekly leaderboard: ${error}`);
    }
  },

  /**
   * Verify that the user is authenticated and authorized to update metrics
   * @param userId - The user's ID
   * @throws MetricsAuthError if authentication fails
   */
  async verifyUserAuthentication(userId: string) {
    // Verify user is authenticated
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) {
      throw new MetricsAuthError('User must be authenticated to update metrics');
    }

    // Verify userId matches authenticated user
    if (session.data.session.user.id !== userId) {
      throw new MetricsAuthError('Cannot update metrics for another user');
    }
  },

  /**
   * Get user's measurement system preference
   * @param userId - The user's ID
   * @returns The user's measurement system (metric or imperial)
   */
  async getUserMeasurementSystem(userId: string) {
    // Check cache first
    const cached = measurementSystemCache.get(userId);
    if (cached) {
      return cached;
    }
    
    // If not cached, fetch from database
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('measurement_system')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      logger.error(LogCategory.Metrics, 'Error fetching user profile', profileError.message);
    }
    
    // Default to metric if not specified
    const system = userProfile?.measurement_system || 'metric';
    
    // Cache the result
    measurementSystemCache.set(userId, system);
    
    return system;
  },

  /**
   * Helper method to handle verification and preparation for metric updates
   * @param userId - The user's ID
   * @returns Object containing measurement system
   */
  async prepareMetricUpdate(userId: string) {
    // Verify authentication
    await this.verifyUserAuthentication(userId);
    
    // Get user's measurement system preference
    const measurementSystem = await this.getUserMeasurementSystem(userId);
    
    return { measurementSystem };
  },

  /**
   * Prepare and update a single metric
   * @param userId - The user's ID
   * @param metricType - The type of metric to update
   * @param value - The new metric value
   * @param measurementSystem - The user's measurement system
   * @returns The updated metric data
   */
  async prepareAndUpdateMetric(
    userId: string,
    metricType: MetricType,
    value: number,
    measurementSystem: string
  ) {
    // Get date in local timezone
    const today = DateUtils.getLocalDateString();
    
    // Get metric configuration
    const config = healthMetrics[metricType];
    if (!config) {
      throw new MetricsValidationError(`Unknown metric type: ${metricType}`);
    }
    
    logger.debug(LogCategory.Metrics, 'Metric config', undefined, undefined, {
      metricType,
      defaultGoal: config.defaultGoal,
      unit: config.unit,
      measurementSystem
    });
    
    // Use default goal from config
    const goal = config.defaultGoal;
    
    // Calculate points and goal status
    const { points, goalReached } = calculatePoints(value, metricType, goal);
    
    logger.debug(LogCategory.Metrics, 'Calculated score', undefined, undefined, {
      goalReached,
      points,
      value,
      goal
    });
    
    // Prepare the metric data
    const metricData = {
      user_id: userId,
      date: today,
      metric_type: metricType,
      value,
      goal,
      points,
      goal_reached: goalReached,
      updated_at: new Date().toISOString(),
      is_test_data: false
    };

    logger.debug(LogCategory.Metrics, 'Upserting metric data', undefined, undefined, metricData);

    // Update metric score
    const { data: upsertResult, error: metricError } = await supabase
      .from('daily_metric_scores')
      .upsert(metricData, {
        onConflict: 'user_id,date,metric_type'
      })
      .select();
  
    if (metricError) {
      logger.error(LogCategory.Metrics, 'Error upserting metric', metricError.message);
      // Handle RLS policy violation
      if (metricError.code === '42501') {
        throw new MetricsAuthError('Permission denied: Cannot update metrics for this user');
      }
      throw new MetricsDatabaseError(
        `Failed to update metric: ${metricError.message}`,
        metricError.code
      );
    }

    return upsertResult?.[0] || metricData;
  },

  /**
   * Update daily totals for a user
   * @param userId - The user's ID
   * @param date - The date in YYYY-MM-DD format
   */
  async updateDailyTotals(userId: string, date: string) {
    // Get updated metrics for daily total
    const { data: metrics, error: fetchError } = await supabase
      .from('daily_metric_scores')
      .select('points, goal_reached, metric_type, value')
      .eq('user_id', userId)
      .eq('date', date);

    if (fetchError) {
      logger.error(LogCategory.Metrics, 'Error fetching metrics', fetchError.message);
      throw new MetricsDatabaseError(
        `Failed to fetch updated metrics: ${fetchError.message}`,
        fetchError.code
      );
    }

    logger.debug(LogCategory.Metrics, 'Current metrics state', undefined, undefined, metrics);

    // Calculate total points and completed metrics
    const totalPoints = metrics?.reduce((sum, m) => sum + m.points, 0) ?? 0;
    const metricsCompleted = metrics?.filter(m => m.goal_reached).length ?? 0;
    
    // Calculate overall health score if we have all metrics
    let healthScore = 0;
    if (metrics?.length) {
      const metricValues = metrics.reduce((acc, m) => {
        acc[m.metric_type as MetricType] = m.value;
        return acc;
      }, {} as Record<MetricType, number>);
      
      healthScore = calculateHealthScore(metricValues);
    }

    // Update daily total
    const { data: totalResult, error: totalError } = await supabase
      .from('daily_totals')
      .upsert({
        user_id: userId,
        date,
        total_points: totalPoints,
        metrics_completed: metricsCompleted,
        updated_at: new Date().toISOString(),
        is_test_data: false
      }, {
        onConflict: 'user_id,date'
      })
      .select();

    logger.debug(LogCategory.Metrics, 'Daily total update result', undefined, undefined, {
      totalPoints,
      metricsCompleted,
      healthScore,
      result: totalResult
    });

    if (totalError) {
      // Handle RLS policy violation
      if (totalError.code === '42501') {
        throw new MetricsAuthError('Permission denied: Cannot update daily totals for this user');
      }
      throw new MetricsDatabaseError(
        `Failed to update daily total: ${totalError.message}`,
        totalError.code
      );
    }

    return totalResult?.[0] || null;
  },

  /**
   * Update a single metric value and recalculate scores
   * @param userId - The user's ID
   * @param metricType - The type of metric to update
   * @param value - The new metric value
   * @param options - Additional options (timestamp, unit, goal)
   * @returns The updated metric data
   */
  async updateMetric(
    userId: string, 
    metricType: MetricType, 
    value: number,
    options: {
      timestamp?: string, 
      unit?: string,
      goal?: number
    } = {}
  ) {
    try {
      if (!isValidMetricValue(value, metricType)) {
        throw new MetricsValidationError(`Invalid value for ${metricType}: ${value}`);
      }
      
      logger.info(LogCategory.Metrics, 'Updating metric', undefined, undefined, {
        userId,
        metricType,
        value,
        valueType: typeof value,
        timestamp: options.timestamp || new Date().toISOString()
      });

      // Prepare for metric update
      const { measurementSystem } = await this.prepareMetricUpdate(userId);
      
      // Update the metric
      const metricResult = await this.prepareAndUpdateMetric(
        userId, 
        metricType,
        value, 
        measurementSystem
      );
      
      // Update daily totals
      const today = DateUtils.getLocalDateString();
      const dailyTotal = await this.updateDailyTotals(userId, today);
      
      return {
        metric: metricResult,
        dailyTotal
      };
    } catch (error) {
      if (error instanceof MetricsAuthError || 
          error instanceof MetricsValidationError || 
          error instanceof MetricsDatabaseError) {
        throw error;
      }
      throw new Error(`Failed to update metric: ${error}`);
    }
  },
  
  /**
   * Batch update multiple metrics at once
   * @param userId - The user's ID
   * @param metrics - Object mapping metric types to values
   * @returns Object containing update results
   */
  async updateMetrics(
    userId: string,
    metrics: Partial<Record<MetricType, number>>
  ) {
    try {
      logger.info(LogCategory.Metrics, 'Batch updating metrics', undefined, undefined, {
        userId,
        metricCount: Object.keys(metrics).length
      });
      
      // Filter out undefined/null values
      const validMetrics = Object.entries(metrics)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([type, value]) => ({ type: type as MetricType, value: value as number }));
      
      if (validMetrics.length === 0) {
        return { success: true, updatedMetrics: [], failedMetrics: [], results: {} };
      }
      
      // Validate all metrics first to fail fast
      const invalidMetrics = validMetrics.filter(
        ({ type, value }) => !isValidMetricValue(value, type)
      );
      
      if (invalidMetrics.length > 0) {
        throw new MetricsValidationError(
          `Invalid metric values: ${invalidMetrics.map(m => m.type).join(', ')}`
        );
      }
      
      // Prepare once for all metrics
      const { measurementSystem } = await this.prepareMetricUpdate(userId);
      
      // Build a batch of updates for a single transaction
      const updates = validMetrics.map(({ type, value }) => ({
        user_id: userId,
        date: DateUtils.getLocalDateString(),
        metric_type: type,
        value,
        goal: healthMetrics[type].defaultGoal,
        updated_at: new Date().toISOString(),
        is_test_data: false
      }));
      
      // Use the RPC function to process updates in a single transaction
      if (updates.length > 0) {
        await supabase.rpc('update_metrics_transaction', { 
          updates: JSON.stringify(updates) 
        });
      }
      
      // Then update daily totals once
      const today = DateUtils.getLocalDateString();
      const dailyTotal = await this.updateDailyTotals(userId, today);
      
      // Build result object
      return {
        success: true,
        updatedMetrics: validMetrics.map(m => m.type),
        dailyTotal
      };
    } catch (error) {
      if (error instanceof MetricsAuthError || 
          error instanceof MetricsValidationError || 
          error instanceof MetricsDatabaseError) {
        throw error;
      }
      throw new Error(`Failed to batch update metrics: ${error}`);
    }
  },
  
  /**
   * Get streak information for a specific metric
   * @param userId - The user's ID
   * @param metricType - The type of metric
   * @param minStreakLength - Minimum streak length to consider (default: 2)
   * @returns Array of streak objects with start/end dates and length
   */
  async getMetricStreaks(
    userId: string,
    metricType: MetricType,
    minStreakLength: number = 2
  ) {
    try {
      logger.debug(LogCategory.Metrics, 'Getting streaks for metric', undefined, undefined, {
        userId,
        metricType,
        minStreakLength
      });
      
      // Call the database function to calculate streaks
      const { data, error } = await supabase
        .rpc('get_metric_streaks', {
          p_user_id: userId,
          p_metric_type: metricType,
          p_min_streak_length: minStreakLength
        });
      
      if (error) {
        logger.error(LogCategory.Metrics, 'Error fetching metric streaks', error.message);
        throw new MetricsDatabaseError(
          `Failed to fetch metric streaks: ${error.message}`,
          error.code
        );
      }
      
      logger.debug(LogCategory.Metrics, 'Retrieved metric streaks', undefined, undefined, {
        count: data?.length || 0
      });
      
      return data || [];
    } catch (error) {
      if (error instanceof MetricsDatabaseError) {
        throw error;
      }
      throw new Error(`Failed to get metric streaks: ${error}`);
    }
  }
};
