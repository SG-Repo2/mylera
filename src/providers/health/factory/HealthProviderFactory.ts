import { Platform } from 'react-native';
import { AppleHealthProvider } from '../platforms/apple/AppleHealthProvider';
import { GoogleHealthProvider } from '../platforms/google/GoogleHealthProvider';
import { FitbitHealthProvider } from '../platforms/fitbit/FitbitHealthProvider';
import type { HealthProvider } from '../types';
import { logger, LogCategory, LogLevel } from '@/src/utils/logger';
export type HealthPlatform = 'apple' | 'google' | 'fitbit';

/**
 * Custom error class for health provider-related errors.
 * Provides more specific error information for better debugging and user feedback.
 */
export class HealthProviderError extends Error {
  constructor(
    message: string, 
    public readonly code?: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'HealthProviderError';
    
    // Preserve the original stack trace if possible
    if (originalError && originalError.stack) {
      this.stack = originalError.stack;
    }
  }
}

/**
 * Factory class responsible for creating and managing platform-specific health providers.
 * Uses a singleton pattern to maintain a single instance of the provider.
 */
export class HealthProviderFactory {
  private static instance: HealthProvider | null = null;
  private static platform: HealthPlatform | null = null;
  private static isInitializing = false;
  private static lastError: HealthProviderError | null = null;
  private static initializationPromise: Promise<HealthProvider> | null = null;
  private static currentUserId: string | null = null;

  /**
   * Validates if the current platform is supported for OS-based health providers.
   * Fitbit is platform-independent and thus always valid.
   * 
   * @param deviceType - The type of device/provider to initialize
   * @throws HealthProviderError if the platform is not supported
   */
  private static validatePlatform(deviceType?: 'os' | 'fitbit'): void {
    if (deviceType === 'fitbit') {
      return; // Fitbit is platform-independent
    }
    
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      throw new HealthProviderError(
        `Unsupported platform: ${Platform.OS}`,
        'UNSUPPORTED_PLATFORM'
      );
    }
  }

  /**
   * Initializes the appropriate health provider based on platform or device type.
   * 
   * @param deviceType - 'os' for platform-specific (Apple/Google) or 'fitbit' for Fitbit
   * @returns The initialized health provider
   * @throws HealthProviderError if initialization fails
   */
  private static initializeProvider(deviceType?: 'os' | 'fitbit'): HealthProvider {
    try {
      logger.info(LogCategory.Health, `[HealthProviderFactory] Initializing provider for device type: ${deviceType || 'os'}`);
      this.validatePlatform(deviceType);

      if (deviceType === 'fitbit') {
        logger.info(LogCategory.Health, '[HealthProviderFactory] Creating Fitbit provider');
        this.platform = 'fitbit';
        this.instance = new FitbitHealthProvider();
      } else if (Platform.OS === 'ios') {
        logger.info(LogCategory.Health, '[HealthProviderFactory] Creating Apple Health provider');
        this.platform = 'apple';
        this.instance = new AppleHealthProvider();
      } else {
        logger.info(LogCategory.Health, '[HealthProviderFactory] Creating Google Health provider');
        this.platform = 'google';
        this.instance = new GoogleHealthProvider();
      }

      return this.instance;
    } catch (error) {
      this.lastError = error instanceof HealthProviderError
        ? error
        : new HealthProviderError(
            `Failed to initialize health provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'INITIALIZATION_FAILED',
            error instanceof Error ? error : undefined
          );
      
      this.instance = null;
      this.platform = null;
      logger.error(LogCategory.Health, '[HealthProviderFactory] Initialization failed:', this.lastError.message);
      throw this.lastError;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  private static createDeferredProvider(): HealthProvider {
    const queuedOperations: Array<[string, any[], (result: any) => void, (error: any) => void]> = [];
    
    const executeQueuedOperations = (realProvider: HealthProvider) => {
      queuedOperations.forEach(([method, args, resolve, reject]) => {
        try {
          const result = (realProvider as any)[method](...args);
          if (result instanceof Promise) {
            result.then(resolve).catch(reject);
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      });
    };
    
    // When initialization completes, process queue
    this.initializationPromise!.then(
      provider => executeQueuedOperations(provider),
      error => queuedOperations.forEach(([_, __, ___, reject]) => reject(error))
    );
    
    // Create a proxy handler that queues operations
    return new Proxy({} as HealthProvider, {
      get: (target, prop) => {
        if (typeof prop !== 'string') return undefined;
        
        return (...args: any[]) => {
          return new Promise((resolve, reject) => {
            queuedOperations.push([prop, args, resolve, reject]);
          });
        };
      }
    });
  }

  /**
   * Gets the appropriate health provider instance for the current platform.
   * Creates a new instance if one doesn't exist.
   * 
   * @param deviceType - 'os' for platform-specific (Apple/Google) or 'fitbit' for Fitbit
   * @returns The health provider instance
   * @throws HealthProviderError if initialization is in progress or fails
   */
  static getProvider(deviceType?: 'os' | 'fitbit'): HealthProvider {
    if (this.instance) {
      logger.info(LogCategory.Health, '[HealthProviderFactory] Returning existing provider instance');
      return this.instance;
    }

    if (this.isInitializing && this.initializationPromise) {
      logger.info(LogCategory.Health, '[HealthProviderFactory] Provider initialization in progress, returning proxy');
      return this.createDeferredProvider();
    }

    this.isInitializing = true;
    const provider = this.initializeProvider(deviceType);
    return provider;
  }

  /**
   * Asynchronously gets the health provider. If initialization is in progress,
   * waits for it to complete instead of throwing an error.
   * 
   * @param deviceType - 'os' for platform-specific (Apple/Google) or 'fitbit' for Fitbit
   * @returns Promise resolving to the health provider instance
   */
  static async getProviderAsync(deviceType?: 'os' | 'fitbit'): Promise<HealthProvider> {
    if (this.instance) {
      logger.info(LogCategory.Health, '[HealthProviderFactory] Returning existing provider instance');
      return this.instance;
    }

    if (this.isInitializing) {
      logger.info(LogCategory.Health, '[HealthProviderFactory] Waiting for in-progress initialization...');
      if (this.initializationPromise) {
        return await this.initializationPromise;
      }
    }

    logger.info(LogCategory.Health, '[HealthProviderFactory] Starting provider initialization');
    this.isInitializing = true;
    
    this.initializationPromise = (async () => {
      try {
        this.lastError = null;
        const provider = this.initializeProvider(deviceType);
        return provider;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.lastError = new HealthProviderError(
          `Failed to initialize health provider: ${err.message}`,
          'provider_init_failed',
          err
        );
        throw this.lastError;
      } finally {
        setTimeout(() => {
          this.isInitializing = false;
        }, 100);
      }
    })();
    
    return this.initializationPromise;
  }

  /**
   * Gets the current health platform.
   * 
   * @returns The current health platform ('apple', 'google', or 'fitbit')
   * @throws HealthProviderError if provider is not initialized
   */
  static getPlatform(): HealthPlatform {
    if (!this.platform) {
      throw new HealthProviderError(
        'Health provider not initialized',
        'PROVIDER_NOT_INITIALIZED'
      );
    }
    return this.platform;
  }

  /**
   * Cleans up the current provider instance and releases resources.
   * Should be called when switching users or providers.
   * 
   * @returns Promise that resolves when cleanup is complete
   */
  static async cleanup(): Promise<void> {
    if (this.isInitializing && this.initializationPromise) {
      logger.info(LogCategory.Health, '[HealthProviderFactory] Waiting for initialization before cleanup');
      await this.initializationPromise;
    }
    
    if (!this.instance) {
      logger.info(LogCategory.Health, '[HealthProviderFactory] No instance to clean up');
      return;
    }

    try {
      logger.info(LogCategory.Health, '[HealthProviderFactory] Cleaning up provider...');
      await this.instance.cleanup();
      logger.info(LogCategory.Health, '[HealthProviderFactory] Provider cleaned up successfully');
    } catch (error) {
      const cleanupError = new HealthProviderError(
        `Failed to cleanup health provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLEANUP_FAILED',
        error instanceof Error ? error : undefined
      );
      logger.error(LogCategory.Health, '[HealthProviderFactory] Cleanup error:', cleanupError.message);
      throw cleanupError;
    } finally {
      this.instance = null;
      this.platform = null;
      this.isInitializing = false;
      this.initializationPromise = null;
      this.currentUserId = null;
      this.lastError = null;
    }
  }

  /**
   * Resets the current provider instance and creates a new one.
   * Useful when switching users or needing to reinitialize the provider.
   * 
   * @param deviceType - 'os' for platform-specific (Apple/Google) or 'fitbit' for Fitbit
   * @returns Promise resolving to the new provider instance
   */
  static async resetProvider(deviceType?: 'os' | 'fitbit'): Promise<HealthProvider> {
    logger.info(LogCategory.Health, '[HealthProviderFactory] Resetting provider...');
    await this.cleanup();
    return this.getProviderAsync(deviceType);
  }

  /**
   * Gets the last error that occurred during initialization.
   * 
   * @returns The last error or null if no error occurred
   */
  static getLastError(): HealthProviderError | null {
    return this.lastError;
  }
}