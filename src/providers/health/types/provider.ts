import type { HealthMetrics, RawHealthData, NormalizedMetric } from './metrics';
import type { MetricType } from '../../../types/metrics';
import { PermissionManager, PermissionState, PermissionStatus } from './permissions';
import { HealthProviderPermissionError } from './errors';
import { logger, LogCategory, LogLevel } from '@/src/utils/logger';
import { 
  standardizeHeartRateCalculation,
  standardizeStepsCalculation,
  standardizeCaloriesCalculation,
  standardizeDistanceCalculation
} from '../../../utils/health/normalizeHealthData';

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

/**
 * Abstract base class providing common functionality for health providers.
 * Platform-specific providers should extend this class and implement
 * the abstract methods according to their platform's requirements.
 */
export abstract class BaseHealthProvider implements HealthProvider {
  /** Flag indicating whether the provider has been initialized */
  protected initialized: boolean = false;

  /** Flag to track initialization status */
  protected initializationInProgress: boolean = false;

  /** Track last successful initialization timestamp */
  protected lastInitializationTime: number = 0;

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
    // Verify that the manager was created successfully
    if (!this.permissionManager) {
      logger.error(LogCategory.Health, `[BaseHealthProvider] Failed to create permission manager for user: ${userId}`);
      throw new Error('Failed to initialize permission manager');
    }
  }

  /**
   * Initialize both the provider and its permission management with enhanced safeguards.
   */
  async initializeWithPermissions(userId: string): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initializationInProgress) {
      console.log('[BaseHealthProvider] Initialization already in progress, waiting for completion...');
      // Wait for current initialization to complete
      let attempts = 0;
      while (this.initializationInProgress && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      
      if (this.initializationInProgress) {
        console.error('[BaseHealthProvider] Initialization timeout after waiting 2 seconds');
        throw new Error('Health provider initialization timeout');
      }
      
      // If we're already initialized and not in progress, just return
      if (this.initialized) {
        console.log('[BaseHealthProvider] Already initialized, skipping duplicate initialization');
        return;
      }
    }
    
    try {
      this.initializationInProgress = true;
      
      // Main initialization logic
      await this.initialize();
      await this.initializePermissions(userId);
      
      // Set initialization flags
      this.initialized = true;
      this.lastInitializationTime = Date.now();
      
    } catch (error) {
      // Reset initialization state on error
      this.initialized = false;
      console.error('[BaseHealthProvider] Initialization failed:', error);
      throw error;
    } finally {
      this.initializationInProgress = false;
    }
  }

  /**
   * Safely initialize the health provider with timeout protection.
   * This unified method centralizes all initialization logic and provides safeguards.
   * 
   * @param userId - The unique identifier of the user
   * @returns The current permission status after initialization
   */
  async safeInitialize(userId: string): Promise<PermissionStatus> {
    try {
      // Check if provider is already initialized
      if (!this.initialized) {
        console.log(`[BaseHealthProvider] Provider not initialized, initializing...`);
        await this.initialize();
      } else {
        console.log(`[BaseHealthProvider] Provider already initialized, skipping initialization step`);
      }

      // Check if permission manager is initialized
      if (!this.permissionManager) {
        console.log(`[BaseHealthProvider] Permission manager not initialized, initializing for user ${userId}...`);
        await this.initializePermissions(userId);
      } else {
        console.log(`[BaseHealthProvider] Permission manager already initialized, skipping initialization step`);
      }

      // Check permission status with timeout protection
      console.log(`[BaseHealthProvider] Checking permission status with timeout protection...`);
      const permissionState = await Promise.race([
        this.checkPermissionsStatus(),
        new Promise<PermissionStatus>((_, reject) =>
          setTimeout(() => reject(new Error('Permission check timeout')), 3000)
        )
      ]);

      // Handle different return types from checkPermissionsStatus
      let status: PermissionStatus;
      if (typeof permissionState === 'string') {
        status = permissionState as PermissionStatus;
      } else if (typeof permissionState === 'object' && permissionState !== null && 'status' in permissionState) {
        status = permissionState.status as PermissionStatus;
      } else {
        console.warn(`[BaseHealthProvider] Unexpected permission state format:`, permissionState);
        status = 'not_determined';
      }

      console.log(`[BaseHealthProvider] Safe initialization completed with status: ${status}`);
      return status;
    } catch (error) {
      console.error(`[BaseHealthProvider] Safe initialization error:`, error);
      // Return not_determined on error to allow graceful degradation
      return 'not_determined';
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
      try {
        await this.permissionManager.clearCache();
      } catch (error) {
        logger.error(LogCategory.Health, '[BaseHealthProvider] Error clearing permission cache:', (error as Error).message);
      }
    } else {
      logger.warn(LogCategory.Health, '[BaseHealthProvider] Permission manager is null during handlePermissionDenial');
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
   * Default implementation provides standardized processing across providers.
   * @param rawData - Raw health data from the platform
   * @param type - Type of metric to normalize
   * @returns Array of normalized metrics
   */
  normalizeMetrics(rawData: RawHealthData, type: MetricType): NormalizedMetric[] {
    if (!rawData || !rawData[type] || !rawData[type].length) {
      logger.debug(LogCategory.Health, `No ${type} data to normalize`);
      return [];
    }
    
    try {
      const rawValues = rawData[type].map(item => 
        typeof item.value === 'number' ? item.value : parseFloat(item.value as string)
      );
      
      // Use standardized calculation based on metric type
      const standardizedValue = this.standardizeMetric(type, rawValues);
      
      // Return normalized format with timestamps from the first and last entries
      const timestamps = rawData[type]
        .filter(item => item.startDate)
        .map(item => new Date(item.startDate).getTime())
        .sort((a, b) => a - b);
      
      const startTime = timestamps.length ? new Date(timestamps[0]) : new Date();
      const endTime = timestamps.length ? new Date(timestamps[timestamps.length - 1]) : new Date();
      
      // Get the unit from the first item, or use a default based on metric type
      const unit = rawData[type][0]?.unit || this.getDefaultUnitForType(type);
      
      return [{
        timestamp: startTime.toISOString(),
        value: standardizedValue,
        unit,
        type,
        confidence: 1.0
      }];
    } catch (error) {
      logger.error(LogCategory.Health, `Error normalizing ${type} data: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  
  /**
   * Get default unit for a metric type
   * @param type The metric type
   * @returns The default unit as a string
   */
  protected getDefaultUnitForType(type: MetricType): string {
    switch (type) {
      case 'steps':
      case 'flights_climbed':
        return 'count';
      case 'distance':
        return 'meters';
      case 'calories':
      case 'basal_calories':
        return 'kcal';
      case 'heart_rate':
        return 'bpm';
      case 'exercise':
        return 'minutes';
      default:
        return 'count';
    }
  }

  /**
   * Get aggregated health metrics.
   * Must be implemented by platform-specific providers.
   * @returns Aggregated health metrics
   */
  abstract getMetrics(): Promise<HealthMetrics>;

  /**
   * Ensure the provider is initialized before operations.
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      console.warn('[BaseHealthProvider] Provider accessed before initialization, forcing initialize');
      try {
        await this.initialize();
        this.initialized = true;
      } catch (error) {
        console.error('[BaseHealthProvider] Forced initialization failed:', error);
        throw new Error('Health provider must be initialized before use');
      }
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
        // First attempt without delay
        if (attempt === 0) {
          return await operation();
        }
        
        // Log retry attempts consistently
        logger.info(
          LogCategory.Health,
          `[${this.constructor.name}] Retry attempt ${attempt}/${maxRetries} after ${initialDelay * Math.pow(2, attempt - 1)}ms`
        );
        
        // Apply exponential backoff delay
        await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, attempt - 1)));
        
        // Try the operation again
        return await operation();
      } catch (error) {
        // Transform error to standard format
        lastError = this.standardizeError(error);
        
        if (attempt === maxRetries) {
          // Final attempt failed
          logger.error(
            LogCategory.Health, 
            `[${this.constructor.name}] All retry attempts failed: ${lastError.message}`
          );
        }
      }
    }
    
    throw lastError || new Error('Operation failed after all retry attempts');
  }

  /**
   * Standardize error format across all platforms
   * @param error The error to standardize
   * @returns A standardized Error object
   */
  protected standardizeError(error: unknown): Error {
    try {
      this.handleProviderError('standardizing error', error);
    } catch (e) {
      return e instanceof Error ? e : new Error('Unknown error during standardization');
    }
    return new Error('Unreachable code');
  }

  /**
   * Validate health data with standardized rules
   * @param data The health data to validate
   * @returns Validated and sanitized health data
   */
  protected validateHealthData(data: HealthMetrics): HealthMetrics {
    try {
      const validated = { ...data };
      
      Object.entries(validated).forEach(([key, value]) => {
        if (typeof value === 'number') {
          const metricType = key as MetricType;
          if (!this.validateMetricValue(value, metricType)) {
            this.handleProviderError('validating metric value', 
              `Invalid value: ${value}`, 
              metricType
            );
          }
        }
      });
      
      return validated;
    } catch (error) {
      this.handleProviderError('validating health data', error);
      return data; // This line is unreachable but TypeScript needs it
    }
  }

  /**
   * Standardized health metric normalization that can be used by all providers.
   * This ensures consistent calculation of metrics across platforms.
   * 
   * @param metricType Type of health metric to normalize
   * @param rawValues Array of raw readings
   * @returns Standardized and normalized value
   */
  protected standardizeMetric(metricType: MetricType, rawValues: number[]): number {
    if (!rawValues || rawValues.length === 0) {
      return 0;
    }

    switch (metricType) {
      case 'heart_rate':
        return standardizeHeartRateCalculation(rawValues);
      
      case 'steps':
        return standardizeStepsCalculation(rawValues);
      
      case 'calories':
      case 'basal_calories':
        return standardizeCaloriesCalculation(rawValues);
      
      case 'distance':
        return standardizeDistanceCalculation(rawValues);
      
      case 'flights_climbed':
        // Simple sum for flights climbed
        return Math.round(
          rawValues.filter(v => v >= 0).reduce((sum, val) => sum + val, 0)
        );
      
      case 'exercise':
        // Exercise should be in minutes - cap at 24 hours per day
        return Math.min(
          Math.round(
            rawValues.filter(v => v >= 0).reduce((sum, val) => sum + val, 0)
          ),
          1440 // 24 hours in minutes
        );
      
      default:
        // For any other metrics, just do a basic non-negative average
        const validValues = rawValues.filter(v => v >= 0);
        return validValues.length 
          ? Math.round(validValues.reduce((sum, val) => sum + val, 0) / validValues.length)
          : 0;
    }
  }

  /**
   * Standardized metric aggregation method to be used across all providers
   * Ensures consistent handling of null values and empty arrays
   * @param metrics Array of normalized metrics to aggregate
   * @returns Aggregated value or null if no valid metrics
   */
  protected standardizedAggregateMetric(metrics: NormalizedMetric[]): number {
    // Handle empty or undefined arrays
    if (!metrics || metrics.length === 0) {
      logger.debug(LogCategory.Health, '[BaseHealthProvider] No metrics to aggregate, returning 0');
      return 0;
    }

    // Apply different strategies based on metric type
    const metricType = metrics[0]?.type;
    
    if (metricType === 'heart_rate') {
      // For heart rate, use weighted average with more recent readings weighted higher
      const validHeartRates = metrics
        .filter(m => typeof m.value === 'number' && m.value >= 30 && m.value <= 220)
        .map(m => ({ value: m.value, timestamp: new Date(m.timestamp).getTime() }))
        .sort((a, b) => b.timestamp - a.timestamp); // Sort by most recent first
      
      if (validHeartRates.length === 0) return 0;
      
      // Take weighted average - more recent readings have more weight
      // Most recent 3 readings get 60% of weight, the rest 40%
      if (validHeartRates.length <= 3) {
        const sum = validHeartRates.reduce((acc, hr) => acc + hr.value, 0);
        return Math.round(sum / validHeartRates.length);
      } else {
        const recentReadings = validHeartRates.slice(0, 3);
        const olderReadings = validHeartRates.slice(3);
        
        const recentAvg = recentReadings.reduce((acc, hr) => acc + hr.value, 0) / recentReadings.length;
        const olderAvg = olderReadings.reduce((acc, hr) => acc + hr.value, 0) / olderReadings.length;
        
        return Math.round((recentAvg * 0.6) + (olderAvg * 0.4));
      }
    }
    
    // For all other metrics, sum up all valid values
    const validMetrics = metrics.filter(m => 
      typeof m.value === 'number' && !isNaN(m.value) && isFinite(m.value)
    );
    
    const sum = validMetrics.reduce((total, metric) => total + metric.value, 0);
    return Math.round(sum);
  }

  /**
   * Standardized error handling method for health operations
   * Formats errors consistently and logs them before rethrowing
   * @param operation Description of the operation that failed
   * @param error The original error that was caught
   * @param metricType Optional metric type if operation was metric-specific
   * @throws Formatted error with consistent structure
   */
  protected handleProviderError(operation: string, error: unknown, metricType?: string): never {
    // Create a consistent error format regardless of provider
    const formattedError = error instanceof Error 
      ? error 
      : new Error(typeof error === 'string' ? error : 'Unknown error');
    
    // Add context to the error message
    const contextMessage = metricType 
      ? `[${this.constructor.name}] Error ${operation} for ${metricType}: ${formattedError.message}`
      : `[${this.constructor.name}] Error ${operation}: ${formattedError.message}`;
    
    // Log the error with appropriate category
    logger.error(LogCategory.Health, contextMessage);
    
    // For permission errors, use the standard health permission error type
    if (contextMessage.toLowerCase().includes('permission') || 
        formattedError.message.toLowerCase().includes('permission')) {
      throw new HealthProviderPermissionError(
        metricType || 'health data',
        formattedError.message
      );
    }
    
    // Rethrow with improved context
    formattedError.message = contextMessage;
    throw formattedError;
  }

  /**
   * Fetch multiple health metrics in a single batched operation
   * Reduces API calls when fetching multiple metrics simultaneously
   * @param startDate - Start of the time range
   * @param endDate - End of the time range
   * @param metricTypes - Array of metric types to fetch
   * @returns Preprocessed health metrics ready for aggregation
   */
  protected async batchFetchHealthMetrics(
    startDate: Date,
    endDate: Date,
    metricTypes: MetricType[]
  ): Promise<HealthMetrics> {
    // Skip empty requests
    if (!metricTypes.length) {
      return this.createEmptyHealthMetrics();
    }
    
    try {
      // Fetch all raw metrics in one call
      const rawData = await this.fetchRawMetrics(startDate, endDate, metricTypes);
      
      // Track fetch timing for analytics
      const fetchEndTime = Date.now();
      
      // Process metrics with standard method
      const processedMetrics: Partial<HealthMetrics> = {};
      
      // Process each requested metric type
      for (const type of metricTypes) {
        try {
          const normalizedMetrics = this.normalizeMetrics(rawData, type);
          const aggregatedValue = this.standardizedAggregateMetric(normalizedMetrics);
          
          // Store in result object
          processedMetrics[type] = aggregatedValue;
        } catch (metricError) {
          logger.warn(
            LogCategory.Health, 
            `[${this.constructor.name}] Error processing ${type} metric: ${metricError instanceof Error ? metricError.message : 'Unknown error'}`
          );
          processedMetrics[type] = null;
        }
      }
      
      // Create a complete metrics object
      return {
        id: '',
        user_id: '',
        date: startDate.toISOString().split('T')[0],
        steps: processedMetrics.steps as number | null ?? null,
        distance: processedMetrics.distance as number | null ?? null,
        calories: processedMetrics.calories as number | null ?? null,
        heart_rate: processedMetrics.heart_rate as number | null ?? null,
        exercise: processedMetrics.exercise as number | null ?? null,
        basal_calories: processedMetrics.basal_calories as number | null ?? null,
        flights_climbed: processedMetrics.flights_climbed as number | null ?? null,
        daily_score: 0, // Will be calculated elsewhere
        weekly_score: null,
        streak_days: null,
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      this.handleProviderError('fetching batched health metrics', error);
    }
  }

  /**
   * Create an empty health metrics object for fallback
   * @returns Empty health metrics with all values initialized to null
   */
  private createEmptyHealthMetrics(): HealthMetrics {
    const now = new Date();
    return {
      id: '',
      user_id: '',
      date: now.toISOString().split('T')[0],
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
      last_updated: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }
}