import type { HealthMetrics, RawHealthData, NormalizedMetric } from './metrics';
import type { MetricType } from '../../../types/metrics';
import { PermissionManager, PermissionState, PermissionStatus } from './permissions';
import { withTimeout, DEFAULT_TIMEOUTS } from '../../../utils/timeoutUtils';

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
   * Reset volatile state while maintaining initialization.
   * Used when app returns to foreground.
   */
  resetState(): void;

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
   * Check if provider is initialized
   * @returns true if the provider is initialized, false otherwise
   */
  isInitialized(): boolean;

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

  /** AbortController for cancelling pending requests */
  protected abortController: AbortController | null = null;

  /** User ID for the current provider */
  protected userId: string | null = null;

  /**
   * Protected method to fetch with cancellation support
   * @param url The URL to fetch from
   * @param options Fetch options
   * @returns Promise resolving to the fetch Response
   */
  protected async fetchWithCancellation(url: string, options?: RequestInit): Promise<Response> {
    // Cancel any existing requests
    if (this.abortController) {
      this.abortController.abort();
    }

    // Create new AbortController for this request
    this.abortController = new AbortController();
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      throw error;
    }
  }

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
    const manager = this.permissionManager;
    if (!manager) {
      console.warn('[BaseHealthProvider] No permission manager to handle denial');
      return;
    }

    try {
      await withTimeout(
        (async () => {
          await manager.clearCache();
          await manager.updatePermissionState('denied');
          this.initialized = false; // Reset initialization state
        })(),
        DEFAULT_TIMEOUTS.CLEANUP,
        'Permission denial handling timed out'
      );
    } catch (error) {
      console.error('[BaseHealthProvider] Error handling permission denial:', error);
      throw error;
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
   * Reset volatile state while maintaining initialization
   */
  resetState(): void {
    console.log('[BaseHealthProvider] Resetting provider state');
    this.lastSyncTime = null;
    if (this.permissionManager) {
      this.permissionManager.clearCache().catch(error => {
        console.warn('[BaseHealthProvider] Error clearing permission cache during reset:', error);
      });
    }
  }

  /**
   * Enhanced cleanup with proper state management
   */
  async cleanup(): Promise<void> {
    console.log('[BaseHealthProvider] Starting provider cleanup');
    
    await withTimeout(
      (async () => {
        try {
          if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
          }

          if (this.permissionManager) {
            try {
              await this.permissionManager.clearCache();
              console.log('[BaseHealthProvider] Permission cache cleared');
            } catch (error) {
              console.warn('[BaseHealthProvider] Error clearing permission cache:', error);
            }
          }

          this.setInitialized(false);
          this.lastSyncTime = null;
          this.userId = null;
          this.resetState();
          
          console.log('[BaseHealthProvider] Provider cleanup completed successfully');
        } catch (error) {
          console.error('[BaseHealthProvider] Error during cleanup:', error);
          throw error;
        }
      })(),
      DEFAULT_TIMEOUTS.CLEANUP,
      'Provider cleanup timed out'
    );
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
   * Ensure the provider is initialized before operations
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      console.log('[BaseHealthProvider] Provider not initialized, attempting initialization...');
      try {
        await withTimeout(
          this.initialize(),
          DEFAULT_TIMEOUTS.INITIALIZATION,
          'Provider initialization timed out'
        );
        if (!this.initialized) {
          throw new Error('Provider initialization failed to set initialized flag');
        }
        console.log('[BaseHealthProvider] Provider initialized successfully');
      } catch (error) {
        console.error('[BaseHealthProvider] Provider initialization failed:', error);
        throw error;
      }
    }
  }

  /**
   * Get the timestamp of the last successful sync.
   * @returns Date of last sync or null if never synced
   */
  async getLastSyncTime(): Promise<Date | null> {
    return withTimeout(
      Promise.resolve(this.lastSyncTime),
      DEFAULT_TIMEOUTS.PERMISSION_CHECK,
      'Get last sync time timed out'
    );
  }

  /**
   * Update the last successful sync timestamp.
   * @param date - The timestamp to set
   */
  async setLastSyncTime(date: Date): Promise<void> {
    await withTimeout(
      Promise.resolve(this.lastSyncTime = date),
      DEFAULT_TIMEOUTS.PERMISSION_CHECK,
      'Set last sync time timed out'
    );
  }

  /**
   * Check if the health service is available.
   * Default implementation returns true - override in platform-specific providers.
   * @returns true if the service is available
   */
  async isAvailable(): Promise<boolean> {
    return withTimeout(
      Promise.resolve(true),
      DEFAULT_TIMEOUTS.PERMISSION_CHECK,
      'Availability check timed out'
    );
  }

  /**
   * Check if provider is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Set initialization state
   */
  protected setInitialized(state: boolean): void {
    this.initialized = state;
    console.log(`[BaseHealthProvider] Initialization state set to: ${state}`);
  }

  /**
   * Initialize permissions with proper initialization check
   */
  async initializePermissions(userId: string): Promise<void> {
    console.log('[BaseHealthProvider] Initializing permissions for user:', userId);
    
    await this.ensureInitialized();
    this.userId = userId;

    await withTimeout(
      (async () => {
        try {
          this.permissionManager = new PermissionManager(userId);
          console.log('[BaseHealthProvider] Created permission manager for user:', userId);
          
          await this.permissionManager.clearCache();
          console.log('[BaseHealthProvider] Cleared permission cache');
          
          const status = await this.checkPermissionsStatus();
          await this.permissionManager.updatePermissionState(status.status);
          console.log('[BaseHealthProvider] Updated permission state:', status.status);
        } catch (error) {
          console.error('[BaseHealthProvider] Failed to initialize permissions:', error);
          this.permissionManager = null;
          throw error;
        }
      })(),
      DEFAULT_TIMEOUTS.INITIALIZATION,
      'Permission initialization timed out'
    );
  }
}
