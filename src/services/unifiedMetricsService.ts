import { metricsService } from './metricsService';
import { DateUtils } from '../utils/DateUtils';
import type { HealthProvider } from '../providers/health/types/provider';
import type { HealthMetrics } from '../providers/health/types/metrics';
import type { MetricType, DailyMetricScore } from '../types/schemas';
import { supabase } from './supabaseClient';
import { validateMetricUpdate } from '../utils/scoringUtils';
import { healthMetrics } from '../config/healthMetrics';
import { logger, LogCategory } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';
import { scoreCalculatorService } from './scoreCalculatorService';

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

let METRIC_SOURCES: Record<MetricType, MetricSource> = JSON.parse(JSON.stringify(INITIAL_METRIC_SOURCES));
const METRIC_CACHE_KEY = '@MyLera:metrics:';

interface CachedMetricsData {
  metrics: HealthMetrics;
  timestamp: number;
}

const unifiedMetricsService = {
  resetState() {
    METRIC_SOURCES = JSON.parse(JSON.stringify(INITIAL_METRIC_SOURCES));
  },

  async cacheMetrics(userId: string, metrics: HealthMetrics) {
    try {
      await AsyncStorage.setItem(
        `${METRIC_CACHE_KEY}${userId}`,
        JSON.stringify({ metrics, timestamp: Date.now() })
      );
      logger.debug(LogCategory.Metrics, 'Metrics cached', undefined, userId);
    } catch (error) {
      logger.warn(LogCategory.Error, 'Failed to cache metrics', undefined, userId, error);
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
      logger.debug(LogCategory.Metrics, 'Cached metrics retrieved', undefined, userId);
      return { metrics, timestamp: parsed.timestamp };
    } catch (error) {
      logger.warn(LogCategory.Error, 'Failed to get cached metrics', undefined, userId, error);
      return null;
    }
  },

  async getMetrics(
    userId: string,
    date: string = DateUtils.getLocalDateString(),
    provider?: HealthProvider
  ): Promise<HealthMetrics> {
    logger.info(LogCategory.Metrics, 'Getting metrics', undefined, userId, { date, hasProvider: !!provider });
    
    let useTransaction = false;
    try {
      const { error: txError } = await supabase.rpc('begin_transaction');
      useTransaction = !txError;
      logger.debug(LogCategory.Database, 'Transaction started', undefined, userId);
    } catch (error) {
      logger.warn(LogCategory.Database, 'Transactions not supported', undefined, userId, error);
      useTransaction = false;
    }

    try {
      const syncStatus = this.getSyncStatus();
      logger.debug(LogCategory.Metrics, 'Current sync status', undefined, userId, syncStatus);

      const dbMetrics = await metricsService.getDailyMetrics(userId, date);
      logger.debug(LogCategory.Metrics, 'Database metrics retrieved', undefined, userId, {
        count: dbMetrics.length,
        types: dbMetrics.map(m => m.metric_type)
      });

      const staleMetrics = dbMetrics.filter(metric => 
        this.isMetricStale(metric.metric_type, metric.updated_at)
      );
      
      logger.debug(LogCategory.Metrics, 'Stale metrics found', undefined, userId, {
        count: staleMetrics.length,
        types: staleMetrics.map(m => m.metric_type)
      });

      if (this.hasCompleteMetrics(dbMetrics) && staleMetrics.length === 0) {
        logger.info(LogCategory.Metrics, 'Using complete and fresh database metrics', undefined, userId);
        const metrics = this.transformDatabaseMetricsToHealthMetrics(dbMetrics, userId, date);
        dbMetrics.forEach(metric => this.updateSyncStatus(metric.metric_type));
        if (useTransaction) {
          const { error: commitError } = await supabase.rpc('commit_transaction');
          if (commitError) {
            logger.warn(LogCategory.Database, 'Failed to commit transaction', undefined, userId, commitError);
          }
        }
        return metrics;
      }

      if (provider && (staleMetrics.length > 0 || !this.hasCompleteMetrics(dbMetrics))) {
        logger.info(LogCategory.Metrics, 'Fetching metrics from native provider', undefined, userId);
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
              logger.warn(LogCategory.Database, 'Failed to commit transaction', undefined, userId, commitError);
            }
          }

          logger.info(LogCategory.Metrics, 'Native metrics synchronized successfully', undefined, userId);
          return nativeMetrics;
        } catch (providerError) {
          logger.error(LogCategory.Metrics, 'Provider error during metrics fetch', undefined, userId, providerError);
          if (useTransaction) {
            const { error: rollbackError } = await supabase.rpc('rollback_transaction');
            if (rollbackError) {
              logger.warn(LogCategory.Database, 'Failed to rollback transaction', undefined, userId, rollbackError);
            }
          }
          throw providerError;
        }
      }

      logger.info(LogCategory.Metrics, 'Using database metrics (fallback)', undefined, userId);
      const metrics = this.transformDatabaseMetricsToHealthMetrics(dbMetrics, userId, date);
      dbMetrics.forEach(metric => this.updateSyncStatus(metric.metric_type));
      if (useTransaction) {
        const { error: commitError } = await supabase.rpc('commit_transaction');
        if (commitError) {
          logger.warn(LogCategory.Database, 'Failed to commit transaction', undefined, userId, commitError);
        }
      }
      return metrics;
    } catch (error) {
      if (useTransaction) {
        const { error: rollbackError } = await supabase.rpc('rollback_transaction');
        if (rollbackError) {
          logger.warn(LogCategory.Database, 'Failed to rollback transaction', undefined, userId, rollbackError);
        }
      }
      logger.error(LogCategory.Metrics, 'Error in getMetrics', undefined, userId, error);
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
      metric.value !== null && !isNaN(metric.value) && metric.value >= 0
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
          logger.warn(LogCategory.Metrics, 'Invalid metric value', undefined, userId, {
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
      logger.warn(LogCategory.Metrics, 'Score verification failed', undefined, userId, {
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

  // Debounce sync calls (using a 1-second leading edge)
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
    console.log('Verifying metrics:', {
      nativeMetrics,
      userId
    });

    const { data: verifiedMetrics, error: verificationError } = await supabase
      .from('daily_metric_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('date', nativeMetrics.date);

    console.log('Supabase response:', {
      verifiedMetrics,
      verificationError
    });

    return Object.entries(METRIC_SOURCES)
      .filter(([, source]) => source.source === 'native')
      .map(([type]) => {
        const metricType = type as MetricType;
        const actualMetric = verifiedMetrics?.find(m => m.metric_type === metricType);
        const actualValue = actualMetric ? actualMetric.value : 0;
        const expectedValue = nativeMetrics[metricType] !== undefined ? nativeMetrics[metricType] : null;
        const matched = expectedValue === actualValue;
        return {
          metricType,
          expected: expectedValue,
          actual: actualValue,
          matched,
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
    logger.info(LogCategory.Metrics, 'Starting metrics synchronization', undefined, userId, {
      date,
      metrics: Object.keys(nativeMetrics),
      retryCount
    });

    try {
      // Get list of valid metric types from healthMetrics config
      const validMetricTypes = Object.keys(healthMetrics) as MetricType[];

      // Map nativeMetrics to update objects, filtering for valid metric types only
      const updates = Object.entries(nativeMetrics)
        .filter(([type]) => validMetricTypes.includes(type as MetricType))
        .map(([type, data]) => ({
          user_id: userId,
          date,
          metric_type: type as MetricType,
          value: (data && typeof data === 'object' && 'value' in data) ? data.value : data,
          source: (data && typeof data === 'object' && 'source' in data) ? data.source : 'health_provider',
          updated_at: new Date().toISOString()
        }));

      // Validate each update
      const validUpdates = updates.filter(update => {
        // Skip validation for non-metric fields
        if (!validMetricTypes.includes(update.metric_type)) {
          return true;
        }
        
        const validationResult = validateMetricUpdate(update);
        if (!validationResult.isValid) {
          logger.warn(LogCategory.Metrics, `Validation failed for ${update.metric_type}`, undefined, userId, validationResult.errors);
          return false;
        }
        return true;
      });

      if (validUpdates.length > 0) {
        const jsonUpdates = JSON.stringify(validUpdates);
        // Call the RPC method 'update_metrics_transaction'
        const { error } = await supabase.rpc('update_metrics_transaction', {
          updates: jsonUpdates
        });
        if (error) {
          logger.error(LogCategory.Metrics, 'RPC call failed', undefined, userId, error);
          throw error;
        }
      }

      // Cache the synchronized metrics.
      await unifiedMetricsService.cacheMetrics(userId, nativeMetrics);

    } catch (error) {
      logger.error(LogCategory.Metrics, 'Synchronization failed', undefined, userId, error);
      if (retryCount < 3) {
        logger.info(LogCategory.Retry, `Retrying synchronization (attempt ${retryCount + 1})`, undefined, userId);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return unifiedMetricsService.synchronizeMetrics(nativeMetrics, userId, retryCount + 1);
      }
      throw error;
    }
  }
};

export { unifiedMetricsService };
