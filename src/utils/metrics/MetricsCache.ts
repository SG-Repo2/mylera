import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyMetricScore, MetricType } from '../../types/schemas';

interface CacheConfig {
  ttl: number;
  maxEntries: number;
  invalidationStrategy: 'LRU' | 'FIFO';
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  lastAccessed?: number;
}

interface MetricsWindow {
  start: string;
  end: string;
}

const DEFAULT_CONFIG: CacheConfig = {
  ttl: 1000 * 60 * 60, // 1 hour
  maxEntries: 1000,
  invalidationStrategy: 'LRU',
};

export class MetricsCache {
  private cache: Map<string, CacheEntry<DailyMetricScore[]>>;
  private config: CacheConfig;
  private activeWindow: MetricsWindow;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.activeWindow = {
      start: new Date().toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    };
  }

  /**
   * Generates a cache key for a specific metric type and date range
   */
  private getCacheKey(userId: string, metricType: MetricType, start: string, end: string): string {
    return `metrics:${userId}:${metricType}:${start}:${end}`;
  }

  /**
   * Checks if a cache entry is still valid based on TTL
   */
  private isEntryValid(entry: CacheEntry<any>): boolean {
    const now = Date.now();
    return now - entry.timestamp < this.config.ttl;
  }

  /**
   * Updates the last accessed timestamp for an entry (LRU strategy)
   */
  private updateAccessTime(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
  }

  /**
   * Removes the oldest entry based on the configured invalidation strategy
   */
  private evictOldestEntry(): void {
    if (this.cache.size === 0) return;

    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      const timestamp = this.config.invalidationStrategy === 'LRU' 
        ? (entry.lastAccessed || entry.timestamp)
        : entry.timestamp;

      if (timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Sets the active window for metric data
   */
  setWindow(start: string, end: string): void {
    this.activeWindow = { start, end };
  }

  /**
   * Gets the current active window
   */
  getWindow(): MetricsWindow {
    return { ...this.activeWindow };
  }

  /**
   * Stores metric data in the cache
   */
  async set(
    userId: string,
    metricType: MetricType,
    data: DailyMetricScore[],
    start: string,
    end: string
  ): Promise<void> {
    const key = this.getCacheKey(userId, metricType, start, end);

    // Evict oldest entry if cache is full
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldestEntry();
    }

    const entry: CacheEntry<DailyMetricScore[]> = {
      data,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);

    // Persist to AsyncStorage
    try {
      await AsyncStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.error('Failed to persist metrics to AsyncStorage:', error);
    }
  }

  /**
   * Retrieves metric data from the cache
   */
  async get(
    userId: string,
    metricType: MetricType,
    start: string,
    end: string
  ): Promise<DailyMetricScore[] | null> {
    const key = this.getCacheKey(userId, metricType, start, end);
    let entry = this.cache.get(key);

    // Try to load from AsyncStorage if not in memory
    if (!entry) {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          entry = JSON.parse(stored) as CacheEntry<DailyMetricScore[]>;
          this.cache.set(key, entry);
        }
      } catch (error) {
        console.error('Failed to load metrics from AsyncStorage:', error);
      }
    }

    if (!entry || !this.isEntryValid(entry)) {
      return null;
    }

    this.updateAccessTime(key);
    return entry.data;
  }

  /**
   * Invalidates cache entries for a specific metric type
   */
  async invalidate(userId: string, metricType: MetricType): Promise<void> {
    const prefix = `metrics:${userId}:${metricType}:`;
    
    // Clear from memory cache
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }

    // Clear from AsyncStorage
    try {
      const keys = await AsyncStorage.getAllKeys();
      const metricsKeys = keys.filter(key => key.startsWith(prefix));
      await AsyncStorage.multiRemove(metricsKeys);
    } catch (error) {
      console.error('Failed to invalidate metrics in AsyncStorage:', error);
    }
  }

  /**
   * Clears all cached data
   */
  async clear(): Promise<void> {
    this.cache.clear();
    
    try {
      const keys = await AsyncStorage.getAllKeys();
      const metricsKeys = keys.filter(key => key.startsWith('metrics:'));
      await AsyncStorage.multiRemove(metricsKeys);
    } catch (error) {
      console.error('Failed to clear metrics cache:', error);
    }
  }
}

// Export singleton instance with default configuration
export const metricsCache = new MetricsCache();