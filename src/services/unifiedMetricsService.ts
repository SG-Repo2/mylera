import { metricsService } from './metricsService';
import { DateUtils } from '../utils/DateUtils';
import type { HealthProvider } from '../providers/health/types/provider';
import type { HealthMetrics } from '../providers/health/types/metrics';
import type { MetricType, DailyMetricScore } from '../types/schemas';
import { supabase } from './supabaseClient';

export const unifiedMetricsService = {
  async getMetrics(
    userId: string,
    date: string = DateUtils.getLocalDateString(),
    provider?: HealthProvider
  ): Promise<HealthMetrics> {
    // Start Supabase transaction
    const { error: txError } = await supabase.rpc('begin_transaction');
    if (txError) {
      console.error('[unifiedMetricsService] Failed to start transaction:', txError);
      throw txError;
    }

    try {
      // First attempt to get metrics from Supabase
      const dbMetrics = await metricsService.getDailyMetrics(userId, date);

      // Check if we should fetch native metrics
      const shouldFetch = this.shouldFetchNative(dbMetrics);

      // If we have complete metrics in Supabase and shouldn't fetch, return them
      if (this.hasCompleteMetrics(dbMetrics) && !shouldFetch) {
        console.log('[unifiedMetricsService] Complete metrics found in database');
        const metrics = this.transformDatabaseMetricsToHealthMetrics(dbMetrics, userId, date);
        
        // Commit transaction since we're just reading
        const { error: commitError } = await supabase.rpc('commit_transaction');
        if (commitError) {
          throw commitError;
        }
        
        return metrics;
      }

      // If we have a provider and should fetch, fetch from native
      if (provider && shouldFetch) {
        console.log('[unifiedMetricsService] Fetching metrics from native provider');
        try {
          const nativeMetrics = await provider.getMetrics();
          
          // Update Supabase with the native metrics atomically
          await this.updateMetricsFromNative(nativeMetrics, userId);
          
          // Commit transaction
          const { error: commitError } = await supabase.rpc('commit_transaction');
          if (commitError) {
            throw commitError;
          }

          // Return the native metrics since they're most up-to-date
          return nativeMetrics;
        } catch (providerError) {
          console.error('[unifiedMetricsService] Error fetching from provider:', providerError);
          
          // Rollback on any error
          const { error: rollbackError } = await supabase.rpc('rollback_transaction');
          if (rollbackError) {
            console.error('[unifiedMetricsService] Rollback failed:', rollbackError);
          }
          
          // If provider fails, throw the error after rollback
          throw providerError;
        }
      }

      // If no provider available or shouldn't fetch, return whatever we have in the database
      console.log('[unifiedMetricsService] No provider available or fresh data exists, returning database metrics');
      const metrics = this.transformDatabaseMetricsToHealthMetrics(dbMetrics, userId, date);
      
      // Commit transaction since we're just reading
      const { error: commitError } = await supabase.rpc('commit_transaction');
      if (commitError) {
        throw commitError;
      }
      
      return metrics;
    } catch (error) {
      // Rollback on any error
      const { error: rollbackError } = await supabase.rpc('rollback_transaction');
      if (rollbackError) {
        console.error('[unifiedMetricsService] Rollback failed:', rollbackError);
      }
      console.error('[unifiedMetricsService] Error in getMetrics:', error);
      throw error;
    }
  },

  hasCompleteMetrics(dbMetrics: DailyMetricScore[]): boolean {
    const requiredMetrics: MetricType[] = [
      'steps', 'distance', 'calories', 'heart_rate',
      'basal_calories', 'flights_climbed', 'exercise'
    ];
    const availableMetricTypes = new Set(dbMetrics.map(metric => metric.metric_type));
    const hasAllMetrics = requiredMetrics.every(type => availableMetricTypes.has(type));
    
    // Additional validation: ensure all metrics have valid values
    const hasValidValues = dbMetrics.every(metric => 
      metric.value !== null && 
      !isNaN(metric.value) && 
      metric.value >= 0
    );

    return hasAllMetrics && hasValidValues;
  },

  transformDatabaseMetricsToHealthMetrics(
    dbMetrics: DailyMetricScore[],
    userId: string, 
    date: string
  ): HealthMetrics {
    const now = new Date().toISOString();
    const result: HealthMetrics = {
      id: `${userId}-${date}`,
      user_id: userId,
      date,
      steps: null,
      distance: null,
      calories: null,
      heart_rate: null,
      exercise: null,
      basal_calories: null,
      flights_climbed: null,
      daily_score: 0,
      weekly_score: null,
      streak_days: null,
      last_updated: now,
      created_at: now,
      updated_at: now,
    };

    // Calculate total points from valid metrics
    const totalPoints = dbMetrics.reduce((sum, metric) => sum + (metric.points || 0), 0);
    result.daily_score = totalPoints;

    // Map metric values
    dbMetrics.forEach(metric => {
      const key = metric.metric_type;
      if (key in result && typeof metric.value === 'number' && !isNaN(metric.value)) {
        result[key] = metric.value;
      }
    });

    return result;
  },

  async updateMetricsFromNative(metrics: HealthMetrics, userId: string): Promise<void> {
    const metricTypes: MetricType[] = [
      'steps', 'distance', 'calories', 'heart_rate',
      'basal_calories', 'flights_climbed', 'exercise'
    ];

    try {
      // Process all metrics atomically
      const updatePromises = metricTypes.map(async (type) => {
        const value = metrics[type];
        if (typeof value === 'number' && !isNaN(value)) {
          console.log(`[unifiedMetricsService] Updating ${type}:`, {
            value,
            isValid: !isNaN(value)
          });
          
          try {
            await metricsService.updateMetric(userId, type, value);
          } catch (error) {
            console.error(`[unifiedMetricsService] Error updating ${type}:`, error);
            throw error;
          }
        }
      });

      // Wait for all updates to complete
      await Promise.all(updatePromises);

      // Verify the updates
      const updated = await metricsService.getDailyMetrics(
        userId,
        new Date().toISOString().split('T')[0]
      );

      // Log verification results
      metricTypes.forEach(type => {
        const metric = updated.find(m => m.metric_type === type);
        const expectedValue = metrics[type];
        if (typeof expectedValue === 'number' && (!metric || metric.value !== expectedValue)) {
          console.warn(`[unifiedMetricsService] Metric verification warning for ${type}:`, {
            expected: expectedValue,
            actual: metric?.value
          });
        }
      });

    } catch (error) {
      throw error;
    }
  },

  shouldFetchNative(dbMetrics: DailyMetricScore[]): boolean {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    return !dbMetrics.length || dbMetrics.some(metric => {
      const updateTime = new Date(metric.updated_at).getTime();
      return now.getTime() - updateTime > staleThreshold;
    });
  }
};
