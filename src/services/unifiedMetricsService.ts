import { metricsService } from './metricsService';
import { DateUtils } from '../utils/DateUtils';
import type { HealthProvider } from '../providers/health/types/provider';
import type { HealthMetrics } from '../providers/health/types/metrics';
import type { MetricType, DailyMetricScore } from '../types/schemas';
import { supabase } from './supabaseClient';

// Interface defining the structure of a metric source
interface MetricSource {
  source: 'native' | 'database';
  lastSynced: Date | null;
  metricTypes: MetricType[];
  priority: number; // Higher number = higher priority (e.g., native > database)
  staleness: number; // Minutes until considered stale
  dataSourceName: string; // e.g., "Apple Health", "Google Health Connect", "Database"
}

// Configuration mapping each metric type to its source information
const METRIC_SOURCES: Record<MetricType, MetricSource> = {
  steps: {
    source: 'native',
    priority: 2,
    staleness: 5,
    lastSynced: null,
    metricTypes: ['steps'],
    dataSourceName: "Device Health API"
  },
  distance: {
    source: 'native',
    priority: 2,
    staleness: 5,
    lastSynced: null,
    metricTypes: ['distance'],
    dataSourceName: "Device Health API"
  },
  calories: {
    source: 'native',
    priority: 2,
    staleness: 5,
    lastSynced: null,
    metricTypes: ['calories'],
    dataSourceName: "Device Health API"
  },
  heart_rate: {
    source: 'native',
    priority: 2,
    staleness: 5,
    lastSynced: null,
    metricTypes: ['heart_rate'],
    dataSourceName: "Device Health API"
  },
  basal_calories: {
    source: 'native',
    priority: 2,
    staleness: 5,
    lastSynced: null,
    metricTypes: ['basal_calories'],
    dataSourceName: "Device Health API"
  },
  flights_climbed: {
    source: 'native',
    priority: 2,
    staleness: 5,
    lastSynced: null,
    metricTypes: ['flights_climbed'],
    dataSourceName: "Device Health API"
  },
  exercise: {
    source: 'native',
    priority: 2,
    staleness: 5,
    lastSynced: null,
    metricTypes: ['exercise'],
    dataSourceName: "Device Health API"
  }
};

export const unifiedMetricsService = {
  async getMetrics(
    userId: string,
    date: string = DateUtils.getLocalDateString(),
    provider?: HealthProvider
  ): Promise<HealthMetrics> {
    console.log('[unifiedMetricsService] Getting metrics:', { userId, date, hasProvider: !!provider });
    
    // Start Supabase transaction
    const { error: txError } = await supabase.rpc('begin_transaction');
    if (txError) {
      console.error('[unifiedMetricsService] Failed to start transaction:', txError);
      throw txError;
    }

    try {
      // Get current sync status
      const syncStatus = this.getSyncStatus();
      console.log('[unifiedMetricsService] Current sync status:', syncStatus);

      // First attempt to get metrics from Supabase
      const dbMetrics = await metricsService.getDailyMetrics(userId, date);
      console.log('[unifiedMetricsService] Database metrics:', {
        count: dbMetrics.length,
        types: dbMetrics.map(m => m.metric_type)
      });

      // Determine which metrics need updating based on source configuration
      const staleMetrics = dbMetrics.filter(metric => 
        this.isMetricStale(metric.metric_type, metric.updated_at)
      );
      
      console.log('[unifiedMetricsService] Stale metrics:', {
        count: staleMetrics.length,
        types: staleMetrics.map(m => m.metric_type)
      });

      // If we have complete, fresh metrics in database, return them
      if (this.hasCompleteMetrics(dbMetrics) && staleMetrics.length === 0) {
        console.log('[unifiedMetricsService] Using database metrics (complete and fresh)');
        const metrics = this.transformDatabaseMetricsToHealthMetrics(dbMetrics, userId, date);
        
        // Update sync status for all metrics
        dbMetrics.forEach(metric => this.updateSyncStatus(metric.metric_type));
        
        // Commit transaction since we're just reading
        const { error: commitError } = await supabase.rpc('commit_transaction');
        if (commitError) throw commitError;
        
        return metrics;
      }

      // If we have a provider and need to fetch stale metrics
      if (provider && (staleMetrics.length > 0 || !this.hasCompleteMetrics(dbMetrics))) {
        console.log('[unifiedMetricsService] Fetching from native provider');
        try {
          const nativeMetrics = await provider.getMetrics();
          
          // Update sync status for all metrics received from native provider
          Object.entries(METRIC_SOURCES).forEach(([type]) => {
            const metricType = type as MetricType;
            if (nativeMetrics[metricType] !== null) {
              this.updateSyncStatus(metricType);
            }
          });
          
          // Update Supabase with the native metrics atomically
          await this.updateMetricsFromNative(nativeMetrics, userId);
          
          // Commit transaction
          const { error: commitError } = await supabase.rpc('commit_transaction');
          if (commitError) throw commitError;

          console.log('[unifiedMetricsService] Successfully updated with native metrics');
          return nativeMetrics;
        } catch (providerError) {
          console.error('[unifiedMetricsService] Provider error:', providerError);
          
          // Rollback on any error
          const { error: rollbackError } = await supabase.rpc('rollback_transaction');
          if (rollbackError) {
            console.error('[unifiedMetricsService] Rollback failed:', rollbackError);
          }
          
          throw providerError;
        }
      }

      // If no provider or can't fetch, return database metrics
      console.log('[unifiedMetricsService] Using database metrics (no provider or fetch not needed)');
      const metrics = this.transformDatabaseMetricsToHealthMetrics(dbMetrics, userId, date);
      
      // Update sync status for database metrics
      dbMetrics.forEach(metric => this.updateSyncStatus(metric.metric_type));
      
      // Commit transaction since we're just reading
      const { error: commitError } = await supabase.rpc('commit_transaction');
      if (commitError) throw commitError;
      
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
    // Get list of metric types from our source configuration
    const metricTypes = Object.keys(METRIC_SOURCES) as MetricType[];
    
    console.log('[unifiedMetricsService] Starting native metrics update:', {
      userId,
      availableMetrics: metricTypes.filter(type => metrics[type] !== null)
    });

    try {
      // Process all metrics atomically, but only update those configured for native source
      const updatePromises = metricTypes
        .filter(type => {
          const source = this.getMetricSource(type);
          const value = metrics[type];
          // Only process metrics that are:
          // 1. From native source
          // 2. Have a non-null value
          // 3. Are valid numbers
          return source.source === 'native' && 
                 value !== null && 
                 typeof value === 'number' && 
                 !isNaN(value);
        })
        .map(async (type) => {
          const value = metrics[type];
          const source = this.getMetricSource(type);
          
          console.log(`[unifiedMetricsService] Processing ${type}:`, {
            value,
            source: source.dataSourceName,
            priority: source.priority
          });
          
          try {
            if (value !== null && typeof value === 'number' && !isNaN(value)) {
              await metricsService.updateMetric(userId, type, value);
            }
            // Update sync status only after successful update
            this.updateSyncStatus(type);
          } catch (error) {
            console.error(`[unifiedMetricsService] Error updating ${type}:`, error);
            throw error;
          }
        });

      // Wait for all updates to complete
      await Promise.all(updatePromises);

      // Verify the updates
      const updated = await metricsService.getDailyMetrics(
        userId,
        new Date().toISOString().split('T')[0]
      );

      // Enhanced verification logging
      const verificationResults = metricTypes.map(type => {
        const metric = updated.find(m => m.metric_type === type);
        const expectedValue = metrics[type];
        const source = this.getMetricSource(type);
        
        return {
          type,
          source: source.dataSourceName,
          expected: expectedValue,
          actual: metric?.value,
          synced: source.lastSynced,
          isMatch: metric?.value === expectedValue
        };
      });

      console.log('[unifiedMetricsService] Verification results:', verificationResults);

      // Log any mismatches as warnings
      verificationResults
        .filter(result => !result.isMatch && result.expected !== null)
        .forEach(result => {
          console.warn(`[unifiedMetricsService] Metric verification warning for ${result.type}:`, {
            source: result.source,
            expected: result.expected,
            actual: result.actual,
            lastSynced: result.synced
          });
        });

    } catch (error) {
      console.error('[unifiedMetricsService] Update failed:', error);
      throw error;
    }
  },

  // Check if a specific metric is stale based on configuration
  isMetricStale(metricType: MetricType, lastUpdate?: string): boolean {
    const source = METRIC_SOURCES[metricType];
    const now = new Date();
    
    // If no last update time, consider it stale
    if (!lastUpdate) return true;
    
    const updateTime = new Date(lastUpdate).getTime();
    const staleThreshold = source.staleness * 60 * 1000; // Convert minutes to milliseconds
    
    return now.getTime() - updateTime > staleThreshold;
  },

  // Get the appropriate source for a metric type
  getMetricSource(metricType: MetricType): MetricSource {
    return METRIC_SOURCES[metricType];
  },

  // Update sync status for a metric type
  updateSyncStatus(metricType: MetricType) {
    if (METRIC_SOURCES[metricType]) {
      METRIC_SOURCES[metricType].lastSynced = new Date();
    }
  },

  // Enhanced version of shouldFetchNative that uses the new configuration
  shouldFetchNative(dbMetrics: DailyMetricScore[]): boolean {
    // If no metrics exist, we should fetch
    if (!dbMetrics.length) return true;

    // Check if any metric is stale based on its configuration
    return dbMetrics.some(metric => this.isMetricStale(metric.metric_type, metric.updated_at));
  },

  // Get sync status for all metrics
  getSyncStatus(): Record<MetricType, { lastSynced: Date | null; isStale: boolean }> {
    const status: Record<MetricType, { lastSynced: Date | null; isStale: boolean }> = {} as any;
    
    Object.entries(METRIC_SOURCES).forEach(([type, source]) => {
      status[type as MetricType] = {
        lastSynced: source.lastSynced,
        isStale: this.isMetricStale(type as MetricType, source.lastSynced?.toISOString())
      };
    });
    
    return status;
  }
};
