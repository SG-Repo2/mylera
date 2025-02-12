import { supabase } from './supabaseClient';
import type { MetricType } from '../types/schemas';
import { healthMetrics } from '../config/healthMetrics';
import type { MetricUpdate } from '../utils/batchUtils';

// Error classes for better error categorization
export class MetricsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsAuthError';
  }
}

export class MetricsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsValidationError';
  }
}

export class MetricsNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsNetworkError';
  }
}

// Simple cache implementation focused on reducing duplicate calls
class SimpleCache {
  private store = new Map<string, { data: any; timestamp: number }>();
  private readonly maxAge: number;

  constructor(maxAgeMs: number = 60000) { // Default 1 minute
    this.maxAge = maxAgeMs;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.maxAge;
    if (isExpired) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set(key: string, data: any): void {
    this.store.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.store.clear();
  }
}

// Helper function to calculate metric points and goal status
const calculateMetricScore = (value: number, metricType: MetricType) => {
  const config = healthMetrics[metricType];
  const goalReached = value >= config.defaultGoal;
  let points = 0;
  
  if (__DEV__) {
    points = goalReached ? 50 : 0;
  } else {
    points = Math.min(Math.floor((value / config.defaultGoal) * 100), 100);
  }

  return { points, goalReached };
};

export const metricsService = {
  _cache: new SimpleCache(5 * 60000), // 5 minutes cache for metrics

  // Add session validation method
  async validateSession(): Promise<boolean> {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.warn('[MetricsService] Invalid session:', error?.message || 'No session found');
      this._clearCache(); // Clear cache on invalid session
      return false;
    }

    // Check if session is expired
    const expiresAt = new Date(session.expires_at || 0).getTime();
    const now = new Date().getTime();
    
    if (now >= expiresAt) {
      console.warn('[MetricsService] Session expired');
      this._clearCache(); // Clear cache on expired session
      
      // Try to refresh the session
      const { data: { session: refreshedSession }, error: refreshError } = 
        await supabase.auth.refreshSession();
      
      if (refreshError || !refreshedSession) {
        console.error('[MetricsService] Failed to refresh session:', refreshError?.message);
        return false;
      }
      
      console.log('[MetricsService] Session refreshed successfully');
      return true;
    }

    return true;
  },

  // Get user's daily metrics with caching
  async getDailyMetrics(userId: string, date: string) {
    // Validate session before fetching
    if (!await this.validateSession()) {
      throw new MetricsAuthError('Session expired');
    }

    const cacheKey = `daily_metrics:${userId}:${date}`;
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('daily_metric_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('is_test_data', false);

    if (error) throw error;
    
    const result = data || [];
    this._cache.set(cacheKey, result);
    return result;
  },

  // Get user's historical metrics for the last 7 days
  async getHistoricalMetrics(userId: string, metricType: MetricType, endDate: string) {
    // Validate session before fetching
    if (!await this.validateSession()) {
      throw new MetricsAuthError('Session expired');
    }

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

  // Get daily totals with caching
  async getDailyTotals(date: string) {
    // Validate session before fetching
    if (!await this.validateSession()) {
      throw new MetricsAuthError('Session expired');
    }

    const cacheKey = `daily_totals:${date}`;
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

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
    
    const result = data || [];
    this._cache.set(cacheKey, result);
    return result;
  },

  // Preload common queries
  async preloadCommonQueries(userId: string) {
    const date = new Date().toISOString().split('T')[0];
    await Promise.all([
      this.getDailyMetrics(userId, date),
      this.getDailyTotals(date)
    ]);
  },

  // Clear cache (useful for testing or forced refreshes)
  clearCache() {
    this._cache.clear();
  },

  // Update a single metric
  async updateMetric(userId: string, metricType: MetricType, value: number) {
    console.log('[MetricsService] Updating metric:', {
      userId,
      metricType,
      value,
      valueType: typeof value,
      timestamp: new Date().toISOString()
    });

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
    
    console.log('[MetricsService] Metric config:', {
      metricType,
      defaultGoal: config.defaultGoal,
      unit: config.unit
    });
    
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

    console.log('[MetricsService] Calculated score:', {
      goalReached,
      points,
      value,
      defaultGoal: config.defaultGoal
    });
    
    // Prepare the metric data
    const metricData = {
      user_id: userId,
      date: today,
      metric_type: metricType,
      value,
      points,
      goal_reached: goalReached,
      updated_at: new Date().toISOString(),
      is_test_data: false // Always false to avoid RLS policy violations
    };

    console.log('[MetricsService] Upserting metric data:', metricData);

    // Update metric score
    const { data: upsertResult, error: metricError } = await supabase
      .from('daily_metric_scores')
      .upsert(metricData, {
        onConflict: 'user_id,date,metric_type'
      })
      .select();
  
    if (metricError) {
      console.error('[MetricsService] Error upserting metric:', metricError);
      // Handle RLS policy violation
      if (metricError.code === '42501') {
        throw new MetricsAuthError('Permission denied: Cannot update metrics for this user');
      }
      throw metricError;
    }

    console.log('[MetricsService] Upsert result:', upsertResult);

    // Get updated metrics for daily total
    const { data: metrics, error: fetchError } = await supabase
      .from('daily_metric_scores')
      .select('points, goal_reached, metric_type, value')
      .eq('user_id', userId)
      .eq('date', today);

    if (fetchError) {
      console.error('[MetricsService] Error fetching metrics:', fetchError);
      throw fetchError;
    }

    console.log('[MetricsService] Current metrics state:', metrics);

    const totalPoints = metrics?.reduce((sum, m) => sum + m.points, 0) ?? 0;
    const metricsCompleted = metrics?.filter(m => m.goal_reached).length ?? 0;

    // Update daily total
    const { data: totalResult, error: totalError } = await supabase
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
      })
      .select();

    console.log('[MetricsService] Daily total update result:', {
      totalPoints,
      metricsCompleted,
      result: totalResult
    });

    if (totalError) {
      // Handle RLS policy violation
      if (totalError.code === '42501') {
        throw new MetricsAuthError('Permission denied: Cannot update daily totals for this user');
      }
      throw totalError;
    }
  },

  // New method for batch updates
  async updateMetricsBatch(updates: MetricUpdate[]) {
    if (!updates.length) return;

    // Validate and refresh session if needed
    const isSessionValid = await this.validateSession();
    if (!isSessionValid) {
      throw new MetricsAuthError('Invalid or expired session. Please sign in again.');
    }

    // Get current session after potential refresh
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new MetricsAuthError('User must be authenticated to update metrics');
    }

    // Group updates by user for validation
    const userUpdates = updates.reduce((acc, update) => {
      if (!acc[update.userId]) {
        acc[update.userId] = [];
      }
      acc[update.userId].push(update);
      return acc;
    }, {} as Record<string, MetricUpdate[]>);

    // Verify all updates are for authenticated user
    const authenticatedUserId = session.user.id;
    const unauthorizedUsers = Object.keys(userUpdates).filter(userId => userId !== authenticatedUserId);
    if (unauthorizedUsers.length > 0) {
      throw new MetricsAuthError('Cannot update metrics for other users');
    }

    const today = new Date().toISOString().split('T')[0];

    try {
      // Start a transaction for atomic updates
      const { error: txError } = await supabase.rpc('begin_transaction');
      if (txError) throw txError;

      try {
        // First, ensure daily_totals records exist for all users
        const dailyTotalsInitial = Object.keys(userUpdates).map(userId => ({
          user_id: userId,
          date: today,
          total_points: 0,
          metrics_completed: 0,
          updated_at: new Date().toISOString(),
          is_test_data: false
        }));

        // Create initial daily totals if they don't exist
        const { error: initTotalsError } = await supabase
          .from('daily_totals')
          .upsert(dailyTotalsInitial, {
            onConflict: 'user_id,date',
            ignoreDuplicates: true
          });

        if (initTotalsError) {
          if (initTotalsError.code === '42501') {
            throw new MetricsAuthError('Permission denied: Cannot create daily totals');
          }
          throw initTotalsError;
        }

        // Group updates by user to calculate totals
        const userMetrics: Record<string, { points: number, completed: number }> = {};
        const metricScores = updates.map(update => {
          const { points, goalReached } = calculateMetricScore(update.value, update.metricType);
          
          // Accumulate points and completed metrics for each user
          if (!userMetrics[update.userId]) {
            userMetrics[update.userId] = { points: 0, completed: 0 };
          }
          userMetrics[update.userId].points += points;
          if (goalReached) {
            userMetrics[update.userId].completed += 1;
          }

          return {
            user_id: update.userId,
            date: today,
            metric_type: update.metricType,
            value: update.value,
            points,
            goal_reached: goalReached,
            updated_at: update.timestamp,
            is_test_data: false
          };
        });

        // Batch upsert metric scores
        const { error: metricError } = await supabase
          .from('daily_metric_scores')
          .upsert(metricScores, {
            onConflict: 'user_id,date,metric_type'
          });

        if (metricError) {
          if (metricError.code === '42501') {
            throw new MetricsAuthError('Permission denied: Cannot update metrics');
          }
          throw metricError;
        }

        // Update daily totals for all users in one batch
        const dailyTotalsUpdates = Object.entries(userMetrics).map(([userId, metrics]) => ({
          user_id: userId,
          date: today,
          total_points: metrics.points,
          metrics_completed: metrics.completed,
          updated_at: new Date().toISOString(),
          is_test_data: false
        }));

        const { error: totalError } = await supabase
          .from('daily_totals')
          .upsert(dailyTotalsUpdates, {
            onConflict: 'user_id,date'
          });

        if (totalError) {
          if (totalError.code === '42501') {
            throw new MetricsAuthError('Permission denied: Cannot update daily totals');
          }
          throw totalError;
        }

        // Commit transaction
        const { error: commitError } = await supabase.rpc('commit_transaction');
        if (commitError) throw commitError;

      } catch (error) {
        // Rollback on any error
        await supabase.rpc('rollback_transaction');
        throw error;
      }
    } catch (error) {
      console.error('[MetricsService] Batch update error:', error);
      
      if (error instanceof MetricsAuthError) {
        throw error;
      }
      
      if (error instanceof Error && error.message.startsWith('23') || error instanceof Error && error.message === '42501') {
        throw new MetricsValidationError('Invalid metric data or permissions');
      }
      
      if (error instanceof Error && (error.message === '57P01' || error.message === '57014')) {
        throw new MetricsNetworkError('Database connection error');
      }
      
      throw new Error('Failed to update metrics');
    }
  },

  _clearCache() {
    this._cache = new SimpleCache(5 * 60000);
  }
};
