import type { HealthMetrics, RawHealthData, NormalizedMetric } from './metrics';
import type { MetricType } from '../../../types/metrics';
import { PermissionManager, PermissionState, PermissionStatus } from './permissions';

/**
 * Interface representing a platform-specific health data provider.
 * Implementations handle data fetching, normalization, and permission management
 * for specific health platforms (e.g., Apple HealthKit, Google Health Connect).
 */
export interface HealthProvider {
  /**
   * Initialize the health provider.
   * Must be called before any other operations.
   * @throws {Error} If initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Clean up provider resources.
   * Should be called when the provider is no longer needed.
   */
  cleanup(): Promise<void>;

  /**
   * Initialize permission management for a specific user.
   * @param userId - The unique identifier of the user
   */
  initializePermissions(userId: string): Promise<void>;

  /**
   * Request health data access permissions from the user.
   * @returns The final permission status after the request
   * @throws {HealthProviderPermissionError} If permission request fails
   */
  requestPermissions(): Promise<PermissionStatus>;

  /**
   * Check the current status of health data permissions.
   * @returns Current permission state including status and last check timestamp
   */
  checkPermissionsStatus(): Promise<PermissionState>;

  /**
   * Handle permission denial scenarios.
   * Implementations should clean up any cached data and update permission state.
   */
  handlePermissionDenial(): Promise<void>;

  /**
   * Get the current permission manager instance.
   * @returns The permission manager or null if not initialized
   */
  getPermissionManager(): PermissionManager | null;

  /**
   * Fetch raw health metrics for a specified time range.
   * @param startDate - Start of the time range
   * @param endDate - End of the time range
   * @param types - Array of metric types to fetch
   * @returns Raw health data organized by metric type
   * @throws {Error} If data fetching fails
   */
  fetchRawMetrics(startDate: Date, endDate: Date, types: MetricType[]): Promise<RawHealthData>;

  /**
   * Normalize raw health data into a standardized format.
   * @param rawData - Raw health data from the platform
   * @param type - Type of metric to normalize
   * @returns Array of normalized metrics
   */
  normalizeMetrics(rawData: RawHealthData, type: MetricType): NormalizedMetric[];

  /**
   * Get aggregated health metrics for the current day.
   * @returns Aggregated health metrics including all available data types
   * @throws {Error} If metrics cannot be retrieved
   */
  getMetrics(): Promise<HealthMetrics>;

  /**
   * Check if the health service is available on the current device.
   * @returns true if the service is available, false otherwise
   */
  isAvailable?(): Promise<boolean>;

  /**
   * Get the timestamp of the last successful data sync.
   * @returns Date of last sync or null if never synced
   */
  getLastSyncTime?(): Promise<Date | null>;

  /**
   * Update the last successful sync timestamp.
   * @param date - The timestamp to set
   */
  setLastSyncTime?(date: Date): Promise<void>;
}

/**
 * Abstract base class providing common functionality for health providers.
 * Platform-specific providers should extend this class and implement
 * the abstract methods according to their platform's requirements.
 */
export abstract class BaseHealthProvider implements HealthProvider {
  /** Flag indicating whether the provider has been initialized */
  protected initialized: boolean = false;

  /** Timestamp of the last successful data sync */
  protected lastSyncTime: Date | null = null;

  /** Permission manager instance for handling user permissions */
  protected permissionManager: PermissionManager | null = null;

  /**
   * Initialize the health provider.
   * Must be implemented by platform-specific providers.
   * @throws {Error} If initialization fails
   */
  abstract initialize(): Promise<void>;

  /**
   * Fetch raw health metrics from the platform.
   * Must be implemented by platform-specific providers.
   * @param startDate - Start of the time range
   * @param endDate - End of the time range
   * @param types - Array of metric types to fetch
   * @returns Raw health data organized by metric type
   * @throws {Error} If data fetching fails
   */
  abstract fetchRawMetrics(
    startDate: Date,
    endDate: Date,
    types: MetricType[]
  ): Promise<RawHealthData>;

  /**
   * Initialize permission management for a specific user.
   * Creates a new PermissionManager instance for the user.
   * @param userId - The unique identifier of the user
   */
  async initializePermissions(userId: string): Promise<void> {
    this.permissionManager = new PermissionManager(userId);
  }

  /**
   * Request health data access permissions.
   * Must be implemented by platform-specific providers.
   * @returns The final permission status after the request
   */
  abstract requestPermissions(): Promise<PermissionStatus>;

  /**
   * Check current permission status.
   * Must be implemented by platform-specific providers.
   * @returns Current permission state
   */
  abstract checkPermissionsStatus(): Promise<PermissionState>;

  /**
   * Handle permission denial by clearing cached data.
   * Can be overridden by platform-specific providers for additional cleanup.
   */
  async handlePermissionDenial(): Promise<void> {
    if (this.permissionManager) {
      await this.permissionManager.clearCache();
    }
  }

  /**
   * Get the current permission manager instance.
   * @returns The permission manager or null if not initialized
   */
  getPermissionManager(): PermissionManager | null {
    return this.permissionManager;
  }

  /**
   * Clean up provider resources.
   * Resets initialization state and clears sync timestamp.
   */
  async cleanup(): Promise<void> {
    this.initialized = false;
    this.lastSyncTime = null;
  }

  /**
   * Normalize raw health data into a standardized format.
   * Default implementation throws an error - must be implemented by providers.
   * @param rawData - Raw health data from the platform
   * @param type - Type of metric to normalize
   * @returns Array of normalized metrics
   * @throws {Error} If not implemented by the provider
   */
  normalizeMetrics(rawData: RawHealthData, type: MetricType): NormalizedMetric[] {
    throw new Error('Method not implemented.');
  }

  /**
   * Get aggregated health metrics.
   * Must be implemented by platform-specific providers.
   * @returns Aggregated health metrics
   */
  abstract getMetrics(): Promise<HealthMetrics>;

  /**
   * Ensure the provider is initialized before operations.
   * @throws {Error} If initialization fails
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get the timestamp of the last successful sync.
   * @returns Date of last sync or null if never synced
   */
  async getLastSyncTime(): Promise<Date | null> {
    return this.lastSyncTime;
  }

  /**
   * Update the last successful sync timestamp.
   * @param date - The timestamp to set
   */
  async setLastSyncTime(date: Date): Promise<void> {
    this.lastSyncTime = date;
  }

  /**
   * Check if the health service is available.
   * Default implementation returns true - override in platform-specific providers.
   * @returns true if the service is available
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }
}
