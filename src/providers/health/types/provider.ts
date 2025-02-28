import type { HealthMetrics, RawHealthData, NormalizedMetric } from './metrics';
import type { MetricType } from '../../../types/metrics';
import { PermissionManager, PermissionState, PermissionStatus } from './permissions';
import { HealthProviderPermissionError } from './errors';
import { logger, LogCategory, LogLevel } from '@/src/utils/logger';

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
  fetchRawMetrics(
    startDate: Date,
    endDate: Date,
    types: MetricType[]
  ): Promise<RawHealthData>;

  /**
   * Normalize raw health data into a standardized format.
   * @param rawData - Raw health data from the platform
   * @param type - Type of metric to normalize
   * @returns Array of normalized metrics
   */
  normalizeMetrics(
    rawData: RawHealthData,
    type: MetricType
  ): NormalizedMetric[];

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
   * @param maxRetries - Maximum number of retry attempts
   * @param initialDelay - Initial delay in milliseconds
   * @returns Result of the operation
   */
  retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries?: number,
    initialDelay?: number
  ): Promise<T>;
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

  /** Cache for supported metric types */
  protected supportedMetricTypes: MetricType[] | null = null;

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
    logger.info(LogCategory.Health, `[BaseHealthProvider] Initializing permissions for user: ${userId}`);
    this.permissionManager = new PermissionManager(userId);
  }

  /**
   * Initialize both the provider and its permission management.
   * @param userId - The unique identifier of the user
   * @throws {Error} If initialization fails
   */
  async initializeWithPermissions(userId: string): Promise<void> {
    try {
      logger.info(LogCategory.Health, `[BaseHealthProvider] Initializing provider and permissions for user: ${userId}`);
      await this.initialize();
      await this.initializePermissions(userId);
      logger.info(LogCategory.Health, '[BaseHealthProvider] Provider and permissions initialized successfully');
    } catch (error) {
      logger.error(LogCategory.Health, '[BaseHealthProvider] Failed to initialize with permissions:');
      throw error instanceof Error 
        ? error 
        : new Error(`Failed to initialize with permissions: ${error}`);
    }
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
    logger.info(LogCategory.Health, '[BaseHealthProvider] Handling permission denial');
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
    logger.info(LogCategory.Health, '[BaseHealthProvider] Cleaning up provider');
    this.initialized = false;
    this.lastSyncTime = null;
    this.supportedMetricTypes = null;
    
    // Clear permission manager cache if it exists
    if (this.permissionManager) {
      try {
        await this.permissionManager.clearCache();
        this.permissionManager = null;
      } catch (error) {
        logger.error(LogCategory.Health, '[BaseHealthProvider] Error clearing permission cache:');
      }
    }
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

      logger.info(LogCategory.Health, '[BaseHealthProvider] Provider not initialized, initializing...');
      await this.initialize();
      logger.info(LogCategory.Health, '[BaseHealthProvider] Provider initialized successfully');
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
  
  /**
   * Get the available metric types supported by this provider.
   * Default implementation returns a common set - override in platform-specific providers.
   * @returns Array of supported metric types
   */
  async getSupportedMetricTypes(): Promise<MetricType[]> {
    if (this.supportedMetricTypes) {
      return this.supportedMetricTypes;
    }
    
    // Default supported metrics - platform-specific providers should override this
    this.supportedMetricTypes = [
      'steps',
      'distance',
      'calories',
      'heart_rate',
      'exercise',
      'basal_calories',
      'flights_climbed'
    ];
    
    return this.supportedMetricTypes;
  }
  
  /**
   * Validate a metric value to ensure it is reasonable.
   * @param value - The metric value to validate
   * @param type - The type of metric
   * @returns true if the value is valid
   */
  protected validateMetricValue(value: number, type: MetricType): boolean {
    if (isNaN(value) || !isFinite(value)) {
      return false;
    }
    
    switch (type) {
      case 'steps':
        return value >= 0 && value < 100000; // Reasonable upper limit
      case 'distance':
        return value >= 0 && value < 100000; // meters
      case 'calories':
      case 'basal_calories':
        return value >= 0 && value < 10000; // kcal
      case 'heart_rate':
        return value >= 30 && value < 220; // bpm
      case 'exercise':
        return value >= 0 && value < 1440; // minutes (max 24 hours)
      case 'flights_climbed':
        return value >= 0 && value < 1000; // reasonable upper limit
      default:
        return value >= 0;
    }
  }
  
  /**
   * Retry a failed operation with exponential backoff.
   * @param operation - The async operation to retry
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param initialDelay - Initial delay in milliseconds (default: 1000)
   * @returns Result of the operation
   * @throws Last error encountered if all retries fail
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // On first attempt, we just run the operation
        if (attempt === 0) {
          return await operation();
        }
        
        // For subsequent attempts, apply exponential backoff
        const delay = initialDelay * Math.pow(2, attempt - 1);
        logger.info(
          LogCategory.Health,
          `[BaseHealthProvider] Retry attempt ${attempt}/${maxRetries} after ${delay}ms`
        );
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Try the operation again
        return await operation();
      } catch (error) {
        lastError = error instanceof Error 
          ? error 
          : new Error(`Unknown error: ${error}`);
        
        logger.warn(
          LogCategory.Health,
          `[BaseHealthProvider] Operation failed (attempt ${attempt}/${maxRetries}):`, 
          lastError.message
        );
        
        // If this is the last attempt, we'll fall through and throw the error
        if (attempt === maxRetries) {
          logger.error(LogCategory.Health, '[BaseHealthProvider] All retry attempts failed');
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Operation failed after all retry attempts');
  }
}