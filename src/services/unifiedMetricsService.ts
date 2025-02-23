import { metricsService } from './metricsService';
import { DateUtils } from '../utils/DateUtils';
import type { HealthProvider } from '../providers/health/types/provider';
import type { HealthMetrics } from '../providers/health/types/metrics';
import type { MetricType, DailyMetricScore } from '../types/schemas';
import { supabase } from './supabaseClient';

interface MetricSource {
  source: string;
  priority: number;
  staleness: number;
  lastSynced: Date | null;
  metricTypes: string[];
  dataSourceName: string;
}

// First, extract the initial configuration to a constant
const INITIAL_METRIC_SOURCES: Record<MetricType, MetricSource> = {
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

// Then modify the service to use a mutable copy
let METRIC_SOURCES: Record<MetricType, MetricSource> = JSON.parse(JSON.stringify(INITIAL_METRIC_SOURCES));

export const unifiedMetricsService = {
  // Add reset function
  resetState() {
    METRIC_SOURCES = JSON.parse(JSON.stringify(INITIAL_METRIC_SOURCES));
  },

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
          
          // Synchronize native metrics with the database
          await this.synchronizeMetrics(nativeMetrics, userId);
          
          // Commit transaction
          const { error: commitError } = await supabase.rpc('commit_transaction');
          if (commitError) throw commitError;

          console.log('[unifiedMetricsService] Successfully synchronized native metrics');
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
  },

  // Verify metric updates by comparing with database values
  async verifyMetricUpdates(
    nativeMetrics: HealthMetrics,
    userId: string
  ): Promise<Array<{
    metricType: MetricType;
    expected: number | null;
    actual: number | null;
    matched: boolean;
    timestamp: string;
  }>> {
    const { data: verifiedMetrics, error: verificationError } = await supabase
      .from('daily_metric_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('date', nativeMetrics.date);

    if (verificationError) {
      console.warn("[synchronizeMetrics] Warning: Error verifying updates:", verificationError);
      return [];
    }

    return Object.entries(METRIC_SOURCES)
      .filter(([, source]) => source.source === 'native')
      .map(([type]) => {
        const metricType = type as MetricType;
        const expectedValue = nativeMetrics[metricType];
        const actualValue = verifiedMetrics?.find(m => m.metric_type === metricType)?.value ?? null;
        
        return {
          metricType,
          expected: expectedValue,
          actual: actualValue,
          matched: expectedValue === actualValue,
          timestamp: new Date().toISOString()
        };
      });
  },

  // Synchronize native metrics with the database atomically
  async synchronizeMetrics(
    nativeMetrics: HealthMetrics,
    userId: string
  ): Promise<void> {
    console.log('[synchronizeMetrics] Starting synchronization:', {
      userId,
      date: nativeMetrics.date,
      metrics: Object.entries(METRIC_SOURCES)
        .filter(([, source]) => source.source === 'native')
        .map(([type]) => type)
    });

    const syncStartTime = Date.now();

    try {
      // Build updates array for native metrics
      const updates = Object.entries(METRIC_SOURCES)
        .filter(([type, source]) => 
          source.source === 'native' && 
          nativeMetrics[type as MetricType] !== null &&
          typeof nativeMetrics[type as MetricType] === 'number' &&
          !isNaN(nativeMetrics[type as MetricType] as number)
        )
        .map(([type]) => ({
          user_id: userId,
          date: nativeMetrics.date,
          metric_type: type,
          value: nativeMetrics[type as MetricType],
          updated_at: new Date().toISOString()
        }));

      if (updates.length === 0) {
        console.log('[synchronizeMetrics] No valid metrics to update');
        return;
      }

      // Perform atomic update via RPC
      const { error: updateError } = await supabase.rpc('update_metrics_transaction', {
        updates: JSON.stringify(updates)
      });

      if (updateError) {
        console.error("[synchronizeMetrics] Transaction error:", updateError);
        throw updateError;
      }

      // Verify the updates
      const verificationResults = await this.verifyMetricUpdates(nativeMetrics, userId);
      
      // Log verification results
      const failedVerifications = verificationResults.filter(r => !r.matched);
      if (failedVerifications.length > 0) {
        console.warn('[synchronizeMetrics] Verification failures:', failedVerifications);
      } else {
        console.log('[synchronizeMetrics] All metrics verified successfully');
      }

      // Update sync status for processed metrics
      updates.forEach(update => {
        this.updateSyncStatus(update.metric_type as MetricType);
      });

      const syncDuration = Date.now() - syncStartTime;
      console.log('[synchronizeMetrics] Synchronization completed:', {
        duration: syncDuration,
        updatedMetrics: updates.length,
        verificationFailures: failedVerifications.length
      });

    } catch (error) {
      console.error('[synchronizeMetrics] Synchronization failed:', error);
      throw error;
    }
  }
};
