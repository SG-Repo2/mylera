import type { HealthMetrics, RawHealthData, NormalizedMetric } from './metrics';
import type { MetricType } from '../../../types/metrics';
import { PermissionManager, PermissionState, PermissionStatus } from './permissions';
import { HealthProviderPermissionError } from './errors';

/**
 * Interface representing a platform-specific health data provider.
 * Implementations handle data fetching, normalization, and permission management
 * for specific health platforms (e.g., Apple HealthKit, Google Health Connect, Fitbit).
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

  /**
   * Initialize both the provider and its permission management.
   * @param userId - The unique identifier of the user
   * @throws {Error} If initialization fails
   */
  initializeWithPermissions(userId: string): Promise<void>;

  /**
   * Get the available metric types supported by this provider.
   * @returns Array of supported metric types
   */
  getSupportedMetricTypes(): Promise<MetricType[]>;

  /**
   * Retry a failed operation with exponential backoff.
   * @param operation - The async operation to retry
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param initialDelay - Initial delay in milliseconds (default: 1000)
   * @returns Result of the operation
   * @throws Last error encountered if all retries fail
   */
  retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries?: number,
    initialDelay?: number
  ): Promise<T>;

  /**
   * Safely initialize the health provider with timeout protection.
   * This unified method centralizes all initialization logic and provides safeguards.
   *
   * @param userId - The unique identifier of the user
   * @returns The current permission status after initialization
   */
  safeInitialize(userId: string): Promise<PermissionStatus>;
}
