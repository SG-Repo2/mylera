import { MetricType } from '@/src/types/metrics';
import { NormalizedMetric, HealthMetrics } from '../types/metrics';
import { DisplayMetric } from '@/src/components/metrics/types';

type TimeFrame = 'daily' | 'weekly' | 'monthly';
type MetricSubscriber = (metrics: DisplayMetric) => void;

export class MetricsStore {
  private cache: Map<string, NormalizedMetric>;
  private subscribers: Set<MetricSubscriber>;
  private static instance: MetricsStore;

  private constructor() {
    this.cache = new Map();
    this.subscribers = new Set();
  }

  static getInstance(): MetricsStore {
    if (!MetricsStore.instance) {
      MetricsStore.instance = new MetricsStore();
    }
    return MetricsStore.instance;
  }

  private getCacheKey(type: MetricType, timestamp: string): string {
    return `${type}:${timestamp}`;
  }

  private calculateTrend(current: NormalizedMetric, previous?: NormalizedMetric): 'up' | 'down' | 'stable' {
    if (!previous) return 'stable';
    const diff = current.value - previous.value;
    if (Math.abs(diff) < 0.05 * previous.value) return 'stable';
    return diff > 0 ? 'up' : 'down';
  }

  private formatForDisplay(
    current: NormalizedMetric,
    previous?: NormalizedMetric,
    goal?: number
  ): DisplayMetric {
    return {
      current: {
        value: current.value,
        unit: current.unit,
        timestamp: current.timestamp,
        source: 'health_provider'
      },
      previous: previous ? {
        value: previous.value,
        unit: previous.unit,
        timestamp: previous.timestamp,
        source: 'health_provider'
      } : undefined,
      goal,
      progress: goal ? Math.min(current.value / goal, 1) : 0,
      trend: this.calculateTrend(current, previous)
    };
  }

  async update(newMetrics: NormalizedMetric[]): Promise<void> {
    for (const metric of newMetrics) {
      const key = this.getCacheKey(metric.type, metric.timestamp);
      this.cache.set(key, metric);
    }
    this.notifySubscribers();
  }

  getMetricsForDisplay(
    type: MetricType,
    timeframe: TimeFrame,
    goal?: number
  ): DisplayMetric | null {
    // Get current period metric
    const now = new Date();
    const currentKey = this.getCacheKey(type, now.toISOString());
    const currentMetric = this.cache.get(currentKey);

    if (!currentMetric) return null;

    // Get previous period metric for comparison
    const previousDate = new Date(now);
    switch (timeframe) {
      case 'daily':
        previousDate.setDate(previousDate.getDate() - 1);
        break;
      case 'weekly':
        previousDate.setDate(previousDate.getDate() - 7);
        break;
      case 'monthly':
        previousDate.setMonth(previousDate.getMonth() - 1);
        break;
    }

    const previousKey = this.getCacheKey(type, previousDate.toISOString());
    const previousMetric = this.cache.get(previousKey);

    return this.formatForDisplay(currentMetric, previousMetric, goal);
  }

  subscribe(callback: MetricSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    // Get latest metrics for each type
    const types: MetricType[] = ['steps', 'distance', 'calories', 'heart_rate', 'exercise', 'standing'];
    
    for (const type of types) {
      const metric = this.getMetricsForDisplay(type, 'daily');
      if (metric) {
        this.subscribers.forEach(callback => callback(metric));
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.notifySubscribers();
  }
}

// Export singleton instance
export const metricsStore = MetricsStore.getInstance();