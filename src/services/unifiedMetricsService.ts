// [unifiedMetricsService.ts]
import { metricsService } from './metricsService';
import { DateUtils } from '../utils/DateUtils';
import type { HealthProvider } from '../providers/health/types/provider';
import type { HealthMetrics } from '../providers/health/types/metrics';
import type { MetricType, DailyMetricScore } from '../types/schemas';
import { supabase } from './supabaseClient';
import { validateMetricUpdate } from '../utils/scoringUtils';

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
    staleness: 2,
    lastSynced: null,
    metricTypes: ['heart_rate'],
    dataSourceName: "Device Health API",
    requiresValidation: true
  },
  basal_calories: {
    source: 'calculated',
    priority: 3,
    staleness: 60,
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

let METRIC_SOURCES: Record<MetricType, MetricSource> = JSON.parse(JSON.stringify(INITIAL_METRIC_SOURCES));
const METRIC_CACHE_KEY = '@MyLera:metrics:';
const SYNC_STATUS_KEY = '@MyLera:sync_status';

interface CachedMetricsData {
  metrics: HealthMetrics;
  timestamp: number;
}

export const unifiedMetricsService = {
  resetState() {
    METRIC_SOURCES = JSON.parse(JSON.stringify(INITIAL_METRIC_SOURCES));
  },

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

  async getCachedMetrics(userId: string): Promise<CachedMetricsData | null> {
    try {
      const cached = await AsyncStorage.getItem(`${METRIC_CACHE_KEY}${userId}`);
      if (!cached) return null;
      const parsed = JSON.parse(cached) as CachedMetricsData;
      const metrics = {
        ...parsed.metrics,
        created_at: new Date(parsed.metrics.created_at).toISOString(),
        updated_at: new Date(parsed.metrics.updated_at).toISOString(),
        last_updated: new Date(parsed.metrics.last_updated).toISOString(),
      };
      return { metrics, timestamp: parsed.timestamp };
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
    
    let useTransaction = false;
    try {
      const { error: txError } = await supabase.rpc('begin_transaction');
      useTransaction = !txError;
    } catch (error) {
      console.warn('[unifiedMetricsService] Transactions not supported:', error);
      useTransaction = false;
    }

    try {
      const syncStatus = this.getSyncStatus();
      console.log('[unifiedMetricsService] Current sync status:', syncStatus);

      const dbMetrics = await metricsService.getDailyMetrics(userId, date);
      console.log('[unifiedMetricsService] Database metrics:', {
        count: dbMetrics.length,
        types: dbMetrics.map(m => m.metric_type)
      });

      const staleMetrics = dbMetrics.filter(metric => 
        this.isMetricStale(metric.metric_type, metric.updated_at)
      );
      
      console.log('[unifiedMetricsService] Stale metrics:', {
        count: staleMetrics.length,
        types: staleMetrics.map(m => m.metric_type)
      });

      if (this.hasCompleteMetrics(dbMetrics) && staleMetrics.length === 0) {
        console.log('[unifiedMetricsService] Using database metrics (complete and fresh)');
        const metrics = this.transformDatabaseMetricsToHealthMetrics(dbMetrics, userId, date);
        dbMetrics.forEach(metric => this.updateSyncStatus(metric.metric_type));
        if (useTransaction) {
          const { error: commitError } = await supabase.rpc('commit_transaction');
          if (commitError) {
            console.warn('[unifiedMetricsService] Failed to commit transaction:', commitError);
          }
        }
        return metrics;
      }

      if (provider && (staleMetrics.length > 0 || !this.hasCompleteMetrics(dbMetrics))) {
        console.log('[unifiedMetricsService] Fetching from native provider');
        try {
          const nativeMetrics = await provider.getMetrics();
          Object.entries(METRIC_SOURCES).forEach(([type]) => {
            const metricType = type as MetricType;
            if (nativeMetrics[metricType] !== null) {
              this.updateSyncStatus(metricType);
            }
          });
          
          await this.synchronizeMetrics(nativeMetrics, userId);
          
          if (useTransaction) {
            const { error: commitError } = await supabase.rpc('commit_transaction');
            if (commitError) {
              console.warn('[unifiedMetricsService] Failed to commit transaction:', commitError);
            }
          }

          console.log('[unifiedMetricsService] Successfully synchronized native metrics');
          return nativeMetrics;
        } catch (providerError) {
          console.error('[unifiedMetricsService] Provider error:', providerError);
          if (useTransaction) {
            const { error: rollbackError } = await supabase.rpc('rollback_transaction');
            if (rollbackError) {
              console.warn('[unifiedMetricsService] Failed to rollback transaction:', rollbackError);
            }
          }
          throw providerError;
        }
      }

      console.log('[unifiedMetricsService] Using database metrics (no provider or fetch not needed)');
      const metrics = this.transformDatabaseMetricsToHealthMetrics(dbMetrics, userId, date);
      dbMetrics.forEach(metric => this.updateSyncStatus(metric.metric_type));
      if (useTransaction) {
        const { error: commitError } = await supabase.rpc('commit_transaction');
        if (commitError) {
          console.warn('[unifiedMetricsService] Failed to commit transaction:', commitError);
        }
      }
      return metrics;
    } catch (error) {
      if (useTransaction) {
        const { error: rollbackError } = await supabase.rpc('rollback_transaction');
        if (rollbackError) {
          console.warn('[unifiedMetricsService] Failed to rollback transaction:', rollbackError);
        }
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

    result.daily_score = scoreCalculatorService.calculateTotalScore(result);
    const scoreVerified = scoreCalculatorService.verifyTotalScore(dbMetrics, result.daily_score);
    if (!scoreVerified) {
      console.warn('[transformDatabaseMetricsToHealthMetrics] Score verification failed:', {
        calculated: result.daily_score,
        metrics: dbMetrics
      });
    }

    return result;
  },

  calculateDerivedMetrics(metrics: HealthMetrics): Partial<HealthMetrics> {
    const derived: Partial<HealthMetrics> = {};
    if (metrics.heart_rate !== null) {
      derived.basal_calories = Math.round(metrics.heart_rate * 7.5);
    }
    if (metrics.calories === null && metrics.steps !== null) {
      derived.calories = Math.round(metrics.steps * 0.04);
    }
    if (metrics.distance === null && metrics.steps !== null) {
      derived.distance = Math.round(metrics.steps * 0.762);
    }
    return derived;
  },

  debouncedSync: debounce(async (metrics: HealthMetrics, userId: string) => {
    await unifiedMetricsService.synchronizeMetrics(metrics, userId);
  }, 1000, { leading: true, trailing: false }),

  isMetricStale(metricType: MetricType, lastUpdate?: string): boolean {
    const source = METRIC_SOURCES[metricType];
    const now = new Date();
    if (!lastUpdate) return true;
    const updateTime = new Date(lastUpdate).getTime();
    const staleThreshold = source.staleness * 60 * 1000;
    return now.getTime() - updateTime > staleThreshold;
  },

  getMetricSource(metricType: MetricType): MetricSource {
    return METRIC_SOURCES[metricType];
  },

  updateSyncStatus(metricType: MetricType) {
    if (METRIC_SOURCES[metricType]) {
      METRIC_SOURCES[metricType].lastSynced = new Date();
    }
  },

  shouldFetchNative(dbMetrics: DailyMetricScore[]): boolean {
    if (!dbMetrics.length) return true;
    return dbMetrics.some(metric => this.isMetricStale(metric.metric_type, metric.updated_at));
  },

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

  async synchronizeMetrics(
    nativeMetrics: HealthMetrics,
    userId: string,
    retryCount: number = 0
  ): Promise<void> {
    const date = DateUtils.getLocalDateString();
    console.log('[synchronizeMetrics] Starting synchronization:', {
      userId,
      date,
      metrics: Object.keys(nativeMetrics),
      retryCount
    });

    try {
      // Map nativeMetrics to updates.
      const updates = Object.entries(nativeMetrics).map(([type, data]) => ({
        user_id: userId,
        date,
        metric_type: type as MetricType,
        value: (data && typeof data === 'object' && 'value' in data) ? data.value : data,
        source: (data && typeof data === 'object' && 'source' in data) ? data.source : 'health_provider',
        updated_at: new Date().toISOString()
      }));

      // Validate each update.
      const validUpdates = updates.filter(update => {
        const validationResult = validateMetricUpdate(update);
        if (!validationResult.isValid) {
          console.warn(`[synchronizeMetrics] Validation failed for ${update.metric_type}:`, 
            validationResult.errors);
          return false;
        }
        return true;
      });

      if (validUpdates.length > 0) {
        const jsonUpdates = JSON.stringify(validUpdates);
        // Note: We now call the RPC method 'update_metrics_transaction'
        const { error } = await supabase.rpc('update_metrics_transaction', {
          updates: jsonUpdates
        });
        if (error) throw error;
      }

      // Cache the metrics after successful synchronization.
      await unifiedMetricsService.cacheMetrics(userId, nativeMetrics);

    } catch (error) {
      console.error('[synchronizeMetrics] Synchronization failed:', error);
      if (retryCount < 3) {
        console.log(`[synchronizeMetrics] Retrying after error (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.synchronizeMetrics(nativeMetrics, userId, retryCount + 1);
      }
      throw error;
    }
  }
};