import { metricsService } from './metricsService';
import { DateUtils } from '../utils/DateUtils';
import type { HealthProvider } from '../providers/health/types/provider';
import type { HealthMetrics } from '../providers/health/types/metrics';
import type { MetricType, DailyMetricScore } from '../types/schemas';
import { supabase } from './supabaseClient';

interface MetricSource {
  source: 'native' | 'calculated' | 'composite';
  priority: number;
  staleness: number;
  lastSynced: Date | null;
  metricTypes: string[];
  dataSourceName: string;
  fallbackSource?: 'native' | 'calculated' | 'composite';
  requiresValidation?: boolean;
}

// Enhanced metric source configuration
const INITIAL_METRIC_SOURCES: Record<MetricType, MetricSource> = {
  steps: {
    source: 'native',
    priority: 1,
    staleness: 5,
    lastSynced: null,
    metricTypes: ['steps'],
    dataSourceName: "Device Health API",
    requiresValidation: true
  },
  distance: {
    source: 'composite',
    priority: 2,
    staleness: 5,
    lastSynced: null,
    metricTypes: ['distance', 'steps'],
    dataSourceName: "Device Health API + Calculation",
    fallbackSource: 'calculated',
    requiresValidation: true
  },
  calories: {
    source: 'composite',
    priority: 2,
    staleness: 5,
    lastSynced: null,
    metricTypes: ['calories', 'steps', 'distance'],
    dataSourceName: "Device Health API + Calculation",
    fallbackSource: 'calculated',
    requiresValidation: true
  },
  heart_rate: {
    source: 'native',
    priority: 1,
    staleness: 2, // More frequent updates for heart rate
    lastSynced: null,
    metricTypes: ['heart_rate'],
    dataSourceName: "Device Health API",
    requiresValidation: true
  },
  basal_calories: {
    source: 'calculated',
    priority: 3,
    staleness: 60, // Less frequent updates needed
    lastSynced: null,
    metricTypes: ['basal_calories', 'heart_rate'],
    dataSourceName: "Calculated from Heart Rate",
    requiresValidation: false
  },
  flights_climbed: {
    source: 'native',
    priority: 2,
    staleness: 5,
    lastSynced: null,
    metricTypes: ['flights_climbed'],
    dataSourceName: "Device Health API",
    requiresValidation: true
  },
  exercise: {
    source: 'composite',
    priority: 2,
    staleness: 5,
    lastSynced: null,
    metricTypes: ['exercise', 'heart_rate', 'steps'],
    dataSourceName: "Device Health API + Calculation",
    fallbackSource: 'calculated',
    requiresValidation: true
  }
};

import { scoreCalculatorService } from './scoreCalculatorService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';

// Mutable copy of the configuration
let METRIC_SOURCES: Record<MetricType, MetricSource> = JSON.parse(JSON.stringify(INITIAL_METRIC_SOURCES));

// Cache keys
const METRIC_CACHE_KEY = '@MyLera:metrics:';
const SYNC_STATUS_KEY = '@MyLera:sync_status';

export const unifiedMetricsService = {
  resetState() {
    METRIC_SOURCES = JSON.parse(JSON.stringify(INITIAL_METRIC_SOURCES));
  },

  // Cache management
  async cacheMetrics(userId: string, metrics: HealthMetrics) {
    try {
      await AsyncStorage.setItem(
        `${METRIC_CACHE_KEY}${userId}`,
        JSON.stringify({ metrics, timestamp: Date.now() })
      );
    } catch (error) {
      console.warn('[unifiedMetricsService] Failed to cache metrics:', error);
    }
  },

  async getCachedMetrics(userId: string): Promise<{ metrics: HealthMetrics; timestamp: number } | null> {
    try {
      const cached = await AsyncStorage.getItem(`${METRIC_CACHE_KEY}${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('[unifiedMetricsService] Failed to get cached metrics:', error);
      return null;
    }
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

  // Transform database metrics to HealthMetrics with enhanced validation and scoring
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

    // Map and validate metric values
    dbMetrics.forEach(metric => {
      const key = metric.metric_type;
      if (key in result && typeof metric.value === 'number' && !isNaN(metric.value)) {
        const validation = scoreCalculatorService.calculateMetricScore(key, metric.value);
        if (!validation.validationErrors?.length) {
          result[key] = metric.value;
        } else {
          console.warn(`[transformDatabaseMetricsToHealthMetrics] Invalid metric value:`, {
            type: key,
            value: metric.value,
            errors: validation.validationErrors
          });
        }
      }
    });

    // Calculate total score using scoreCalculatorService
    result.daily_score = scoreCalculatorService.calculateTotalScore(result);

    // Verify the calculated score matches the sum of individual metrics
    const scoreVerified = scoreCalculatorService.verifyTotalScore(dbMetrics, result.daily_score);
    if (!scoreVerified) {
      console.warn('[transformDatabaseMetricsToHealthMetrics] Score verification failed:', {
        calculated: result.daily_score,
        metrics: dbMetrics
      });
    }

    return result;
  },

  // Calculate metrics that can be derived from other metrics
  calculateDerivedMetrics(metrics: HealthMetrics): Partial<HealthMetrics> {
    const derived: Partial<HealthMetrics> = {};

    // Calculate basal calories if we have heart rate
    if (metrics.heart_rate !== null) {
      // Basic BMR calculation using heart rate
      // This is a simplified example - you'd want to use a more sophisticated formula
      derived.basal_calories = Math.round(metrics.heart_rate * 7.5);
    }

    // Calculate calories from steps if direct calorie measurement is missing
    if (metrics.calories === null && metrics.steps !== null) {
      // Basic calculation: ~0.04 calories per step
      derived.calories = Math.round(metrics.steps * 0.04);
    }

    // Calculate distance from steps if direct distance measurement is missing
    if (metrics.distance === null && metrics.steps !== null) {
      // Basic calculation: ~0.762 meters per step
      derived.distance = Math.round(metrics.steps * 0.762);
    }

    return derived;
  },

  // Debounced version of synchronizeMetrics to prevent rapid consecutive calls
  debouncedSync: debounce(async (metrics: HealthMetrics, userId: string) => {
    await unifiedMetricsService.synchronizeMetrics(metrics, userId);
  }, 1000, { leading: true, trailing: false }),

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

  // Enhanced synchronization with retry logic and derived metrics
  async synchronizeMetrics(
    nativeMetrics: HealthMetrics,
    userId: string,
    retryCount: number = 0
  ): Promise<void> {
    console.log('[synchronizeMetrics] Starting synchronization:', {
      userId,
      date: nativeMetrics.date,
      retryCount,
      metrics: Object.entries(METRIC_SOURCES)
        .filter(([, source]) => source.source === 'native')
        .map(([type]) => type)
    });

    const syncStartTime = Date.now();
    const MAX_RETRIES = 3;

    try {
      // Calculate any derived metrics
      const derivedMetrics = this.calculateDerivedMetrics(nativeMetrics);
      const combinedMetrics = { ...nativeMetrics, ...derivedMetrics };

      // Validate all metrics before updating
      const updates = await Promise.all(
        Object.entries(METRIC_SOURCES).map(async ([type, source]) => {
          const metricType = type as MetricType;
          const value = combinedMetrics[metricType];

          // Skip if no value or invalid
          if (value === null || isNaN(value)) return null;

          // Validate metric if required
          if (source.requiresValidation) {
            const validation = scoreCalculatorService.calculateMetricScore(metricType, value);
            if (validation.validationErrors?.length) {
              console.warn(`[synchronizeMetrics] Validation failed for ${metricType}:`, validation.validationErrors);
              return null;
            }
          }

          return {
            user_id: userId,
            date: nativeMetrics.date,
            metric_type: metricType,
            value,
            points: scoreCalculatorService.calculateMetricScore(metricType, value).points,
            updated_at: new Date().toISOString()
          };
        })
      );

      // Filter out null values
      const validUpdates = updates.filter(update => update !== null);

      if (validUpdates.length === 0) {
        console.log('[synchronizeMetrics] No valid metrics to update');
        return;
      }

      // Cache metrics before database update
      await this.cacheMetrics(userId, combinedMetrics);

      // Perform atomic update via RPC
      const { error: updateError } = await supabase.rpc('update_metrics_transaction', {
        updates: JSON.stringify(validUpdates)
      });

      if (updateError) {
        throw updateError;
      }

      // Verify the updates
      const verificationResults = await this.verifyMetricUpdates(combinedMetrics, userId);
      const failedVerifications = verificationResults.filter(r => !r.matched);

      if (failedVerifications.length > 0) {
        console.warn('[synchronizeMetrics] Verification failures:', failedVerifications);
        
        // Retry if verification failed and we haven't exceeded max retries
        if (retryCount < MAX_RETRIES) {
          console.log(`[synchronizeMetrics] Retrying synchronization (attempt ${retryCount + 1})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
          return this.synchronizeMetrics(nativeMetrics, userId, retryCount + 1);
        }
      } else {
        console.log('[synchronizeMetrics] All metrics verified successfully');
      }

      // Update sync status for processed metrics
      validUpdates.forEach(update => {
        this.updateSyncStatus(update.metric_type as MetricType);
      });

      const syncDuration = Date.now() - syncStartTime;
      console.log('[synchronizeMetrics] Synchronization completed:', {
        duration: syncDuration,
        updatedMetrics: validUpdates.length,
        verificationFailures: failedVerifications.length,
        retryCount
      });

    } catch (error) {
      console.error('[synchronizeMetrics] Synchronization failed:', error);
      
      // Retry on error if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        console.log(`[synchronizeMetrics] Retrying after error (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return this.synchronizeMetrics(nativeMetrics, userId, retryCount + 1);
      }
      
      throw error;
    }
  }
};
