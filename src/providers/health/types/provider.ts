import type { HealthMetrics, RawHealthData, NormalizedMetric } from './metrics';
import type { MetricType } from '../../../types/metrics';

export interface HealthProvider {
  // Lifecycle methods
  initialize(): Promise<void>;
  requestPermissions(): Promise<boolean>;
  checkPermissionsStatus(): Promise<boolean>;
  cleanup(): Promise<void>;

  // Raw data methods
  fetchRawMetrics(
    startDate: Date,
    endDate: Date,
    types: MetricType[]
  ): Promise<RawHealthData>;

  // Normalized data methods
  normalizeMetrics(
    rawData: RawHealthData,
    type: MetricType
  ): NormalizedMetric[];

  // Aggregated metrics
  getMetrics(): Promise<HealthMetrics>;

  // Optional: Platform-specific methods
  isAvailable?(): Promise<boolean>;  // Check if the health service is available
  getLastSyncTime?(): Promise<Date | null>;  // Get last successful sync
  setLastSyncTime?(date: Date): Promise<void>;  // Update last sync time
}

// Abstract base class that implements common functionality
export abstract class BaseHealthProvider implements HealthProvider {
  protected initialized: boolean = false;
  protected lastSyncTime: Date | null = null;

  abstract initialize(): Promise<void>;
  abstract requestPermissions(): Promise<boolean>;
  abstract checkPermissionsStatus(): Promise<boolean>;
  abstract fetchRawMetrics(
    startDate: Date,
    endDate: Date,
    types: MetricType[]
  ): Promise<RawHealthData>;

  // Shared implementation for cleanup
  async cleanup(): Promise<void> {
    this.initialized = false;
    this.lastSyncTime = null;
  }

  // Default normalization implementation that can be overridden
  normalizeMetrics(rawData: RawHealthData, type: MetricType): NormalizedMetric[] {
    // Implementation will depend on the specific provider
    throw new Error('Method not implemented.');
  }

  // Default implementation for getting metrics
  abstract getMetrics(): Promise<HealthMetrics>;

  // Utility methods that can be used by all providers
  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async getLastSyncTime(): Promise<Date | null> {
    return this.lastSyncTime;
  }

  async setLastSyncTime(date: Date): Promise<void> {
    this.lastSyncTime = date;
  }

  async isAvailable(): Promise<boolean> {
    return true; // Override in platform-specific implementations
  }
}