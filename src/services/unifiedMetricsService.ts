import { metricsService } from './metricsService';
import { DateUtils } from '../utils/DateUtils';
import type { HealthProvider } from '../providers/health/types/provider';
import type { HealthMetrics } from '../providers/health/types/metrics';
import type { MetricType, DailyMetricScore } from '../types/schemas';

export const unifiedMetricsService = {
  async getMetrics(
    userId: string,
    date: string = DateUtils.getLocalDateString(),
    provider?: HealthProvider
  ): Promise<HealthMetrics> {
    try {
      const dbMetrics = await metricsService.getDailyMetrics(userId, date);
      if (this.hasCompleteMetrics(dbMetrics)) {
        return this.transformDatabaseMetricsToHealthMetrics(dbMetrics, userId, date);
      }
      if (provider) {
        const nativeMetrics = await provider.getMetrics();
        await this.updateMetricsFromNative(nativeMetrics, userId);
        return nativeMetrics;
      }
      return this.transformDatabaseMetricsToHealthMetrics(dbMetrics, userId, date);
    } catch (error) {
      throw error;
    }
  },

  hasCompleteMetrics(dbMetrics: DailyMetricScore[]): boolean {
    const requiredMetrics: MetricType[] = [
      'steps', 'distance', 'calories', 'heart_rate',
      'basal_calories', 'flights_climbed', 'exercise'
    ];
    const availableMetricTypes = new Set(dbMetrics.map(metric => metric.metric_type));
    return requiredMetrics.every(type => availableMetricTypes.has(type));
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
    const totalPoints = dbMetrics.reduce((sum, metric) => sum + metric.points, 0);
    result.daily_score = totalPoints;
    dbMetrics.forEach(metric => {
      const key = metric.metric_type;
      if (key in result && typeof metric.value === 'number') {
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
    
    for (const type of metricTypes) {
      const value = metrics[type];
      if (typeof value === 'number') {
        console.log(`[unifiedMetricsService] Processing ${type}:`, {
          value,
          isValid: !isNaN(value)
        });
        
        try {
          await metricsService.updateMetric(userId, type, value);
          
          // Verify the update was successful
          const updated = await metricsService.getDailyMetrics(userId, new Date().toISOString().split('T')[0]);
          const metric = updated.find(m => m.metric_type === type);
          if (!metric || metric.value !== value) {
            console.warn(`[unifiedMetricsService] Metric update verification failed for ${type}`);
          }
        } catch (error) {
          console.error(`[unifiedMetricsService] Error updating ${type}:`, error);
        }
      }
    }
  }
};