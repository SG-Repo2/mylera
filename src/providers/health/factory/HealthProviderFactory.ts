/**
 * Health Provider Factory
 * 
 * A singleton factory that manages health providers with per-user mutexes
 * to prevent race conditions during concurrent provider operations.
 */

import { Mutex, MutexInterface, withTimeout, E_TIMEOUT } from 'async-mutex';
import { Platform } from 'react-native';
import { AppleHealthProvider } from '../platforms/apple/AppleHealthProvider';
import { GoogleHealthProvider } from '../platforms/google/GoogleHealthProvider';
import { FitbitHealthProvider } from '../platforms/fitbit/FitbitHealthProvider';
import type { HealthProvider } from '../types';
import { 
  HealthProviderError, 
  HealthProviderInitializationError 
} from '../types/errors';
import { logger, LogCategory } from '../../../utils/logger';
import { 
  initializeProviderWithRetry, 
  safelyCleanupProvider 
} from '../../../utils/providerInitializationManager';
import { withTimeout as asyncWithTimeout } from '../../../utils/asyncUtils';
// Define health platforms
export type HealthPlatform = 'apple' | 'google' | 'fitbit';

// Define provider state for tracking initialization
interface ProviderInitState {
  provider: HealthProvider;
  initPromise: Promise<void>;
}

// Configuration constants
const MUTEX_TIMEOUT_MS = 10000; // 10 seconds timeout for mutex acquisition
const PROVIDER_CLEANUP_TIMEOUT_MS = 5000; // 5 seconds timeout for provider cleanup

/**
 * HealthProviderFactory is a singleton factory that manages health providers.
 * It ensures:
 * - Only one provider instance exists per user
 * - Provider initialization and cleanup operations are thread-safe
 * - Proper cancellation and retry logic for provider operations
 * - Deadlock prevention with timeout-based mutex acquisition
 */
export class HealthProviderFactory {
  private static instance: HealthProviderFactory;
  private providers: Map<string, HealthProvider> = new Map();
  private initStates: Map<string, ProviderInitState> = new Map();
  private mutexes: Map<string, MutexInterface> = new Map();

  /**
   * Private constructor to prevent direct instantiation
   */
  private constructor() {}

  /**
   * Get the singleton instance of the factory
   */
  public static getInstance(): HealthProviderFactory {
    if (!HealthProviderFactory.instance) {
      HealthProviderFactory.instance = new HealthProviderFactory();
    }
    return HealthProviderFactory.instance;
  }

  /**
   * Creates a provider instance for the specified platform
   * 
   * @param platform The health platform to create a provider for
   * @returns A new HealthProvider instance
   * @throws HealthProviderError if the platform is not supported
   */
  private createProviderInstance(platform: HealthPlatform): HealthProvider {
    logger.debug(
      LogCategory.Provider,
      `Creating provider instance for platform: ${platform}`
    );

    switch (platform) {
      case 'apple':
        if (Platform.OS !== 'ios') {
          throw new HealthProviderError('Apple Health is only available on iOS');
        }
        return new AppleHealthProvider();
      case 'google':
        if (Platform.OS !== 'android') {
          throw new HealthProviderError('Google Health is only available on Android');
        }
        return new GoogleHealthProvider();
      case 'fitbit':
        return new FitbitHealthProvider();
      default:
        throw new HealthProviderError(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Get a mutex for a specific user with timeout support
   * 
   * @param userId The user ID to get a mutex for
   * @returns A MutexInterface for the user
   */
  private getMutex(userId: string): MutexInterface {
    if (!this.mutexes.has(userId)) {
      logger.debug(
        LogCategory.Provider,
        `Creating new mutex for user: ${userId}`
      );
      this.mutexes.set(userId, new Mutex());
    }
    return this.mutexes.get(userId)!;
  }

  /**
   * Run a function with mutex exclusivity and timeout
   * 
   * @param userId The user ID to acquire a mutex for
   * @param fn The function to run with mutex exclusivity
   * @param operationId An identifier for logging
   * @returns The result of the function
   * @throws Error if mutex acquisition times out
   */
  private async withUserMutex<T>(
    userId: string, 
    fn: () => Promise<T>, 
    operationId: string
  ): Promise<T> {
    const mutex = this.getMutex(userId);
    
    try {
      // Run with timeout to prevent deadlocks
      const result = await asyncWithTimeout( 
        async () => mutex.runExclusive(fn),
        MUTEX_TIMEOUT_MS,
        E_TIMEOUT
      );
      return result as T;
    } catch (error) {
      if (error === E_TIMEOUT) {
        logger.error(
          LogCategory.Provider,
          `Mutex acquisition timed out after ${MUTEX_TIMEOUT_MS}ms`,
          operationId,
          userId
        );
        throw new Error(`Operation timed out waiting for mutex access (user: ${userId})`);
      }
      throw error;
    }
  }

  /**
   * Initializes a provider
   * 
   * @param provider The provider to initialize
   * @param platform The health platform
   * @param userId The user ID
   * @param key A unique key for the provider
   * @throws HealthProviderInitializationError if initialization fails
   */
  private async initializeProvider(
    provider: HealthProvider,
    platform: HealthPlatform,
    userId: string,
    key: string
  ): Promise<void> {
    const operationId = `init-${platform}-${Date.now()}`;
    
    logger.info(
      LogCategory.Provider,
      `Initializing provider`,
      operationId,
      userId,
      { platform }
    );

    try {
      // Set userId before any initialization
      if ('setUserId' in provider && typeof provider.setUserId === 'function') {
        await provider.setUserId(userId);
      }
      
      // Initialize the provider with retry logic
      await initializeProviderWithRetry(
        async (signal) => {
          // Pass the signal to the provider if it supports it
          if ('initialize' in provider && typeof provider.initialize === 'function') {
            // Check if the provider's initialize method accepts a signal
            if (provider.initialize.length > 0) {
              await provider.initialize();
            } else {
              await provider.initialize();
            }
          }
          return provider;
        },
        {
          operationId
        }
      );
      
      // Initialize permissions after provider initialization
      await provider.initializePermissions(userId);
      
      // Registration successful, store the provider
      this.providers.set(key, provider);
      
      logger.info(
        LogCategory.Provider,
        `Provider initialized successfully`,
        operationId,
        userId,
        { platform }
      );
    } catch (error) {
      logger.error(
        LogCategory.Provider,
        `Failed to initialize provider`,
        operationId,
        userId,
        { error, platform }
      );
      
      // Clean up on initialization failure
      await this.cleanup(key);
      
      throw new HealthProviderInitializationError(
        platform, 
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      // Always remove the init state when done
      this.initStates.delete(key);
    }
  }

  /**
   * Gets or creates a provider for the specified platform and user ID
   * 
   * @param platform The health platform to get a provider for
   * @param userId The user ID to get a provider for
   * @returns A Promise resolving to the HealthProvider instance
   * @throws HealthProviderInitializationError if initialization fails
   */
  public async getProvider(
    platform: HealthPlatform,
    userId: string
  ): Promise<HealthProvider> {
    if (!platform) {
      throw new HealthProviderError('Platform must be specified');
    }
    if (!userId) {
      throw new HealthProviderError('UserId must be specified');
    }

    const key = `${platform}:${userId}`;
    const operationId = `get-provider-${Date.now()}`;
    
    logger.debug(
      LogCategory.Provider,
      `Getting provider`,
      operationId,
      userId,
      { platform, key }
    );

    return this.withUserMutex(
      userId,
      async () => {
        // Return existing initialized provider if available
        const existingProvider = this.providers.get(key);
        if (existingProvider) {
          logger.debug(
            LogCategory.Provider,
            `Using existing provider`,
            operationId,
            userId,
            { platform, key }
          );
          return existingProvider;
        }

        // Check if provider is currently being initialized
        const initState = this.initStates.get(key);
        if (initState) {
          logger.debug(
            LogCategory.Provider,
            `Waiting for existing initialization to complete`,
            operationId,
            userId,
            { platform, key }
          );
          
          try {
            // Wait for existing initialization to complete
            await initState.initPromise;
            return initState.provider;
          } catch (error) {
            // If the existing initialization failed, we'll try again
            logger.warn(
              LogCategory.Provider,
              `Previous initialization failed, retrying`,
              operationId,
              userId,
              { error, platform }
            );
          }
        }

        // Create and initialize a new provider
        const provider = this.createProviderInstance(platform);
        
        // Create a promise for the initialization and store it
        const initPromise = this.initializeProvider(provider, platform, userId, key);
        this.initStates.set(key, { provider, initPromise });
        
        // Wait for initialization to complete
        await initPromise;
        
        return provider;
      },
      operationId
    );
  }

  /**
   * Cleans up a provider or all providers
   * 
   * @param key Optional specific provider key to clean up
   * @returns Promise that resolves when cleanup is complete
   */
  public async cleanup(key?: string): Promise<void> {
    const operationId = `cleanup-${Date.now()}`;
    
    logger.debug(
      LogCategory.Provider,
      `Starting provider cleanup`,
      operationId,
      undefined,
      { specificKey: key }
    );

    if (key) {
      // Extract userId from key (format: "platform:userId")
      const userId = key.split(':')[1];
      
      if (!userId) {
        logger.error(
          LogCategory.Provider,
          `Invalid key format for cleanup`,
          operationId,
          undefined,
          { key }
        );
        return;
      }
      
      // Clean up a specific provider with mutex protection
      await this.withUserMutex(
        userId,
        async () => {
          const provider = this.providers.get(key);
          if (provider) {
            logger.debug(
              LogCategory.Provider,
              `Cleaning up specific provider`,
              operationId,
              userId,
              { key }
            );
            
            await safelyCleanupProvider(
              () => provider.cleanup(),
              PROVIDER_CLEANUP_TIMEOUT_MS,
              operationId
            );
            
            this.providers.delete(key);
          }
          this.initStates.delete(key);
        },
        operationId
      );
    } else {
      // Clean up all providers
      logger.debug(
        LogCategory.Provider,
        `Cleaning up all providers`,
        operationId
      );
      
      // Get all user IDs with providers or init states
      const userIds = new Set<string>();
      
      for (const key of [...this.providers.keys(), ...this.initStates.keys()]) {
        const userId = key.split(':')[1];
        if (userId) {
          userIds.add(userId);
        }
      }
      
      // Clean up providers for each user with mutex protection
      await Promise.all(
        Array.from(userIds).map(async (userId) => {
          try {
            await this.withUserMutex(
              userId,
              async () => {
                // Find all keys for this user
                const keysToCleanup = Array.from(this.providers.keys())
                  .filter(k => k.includes(`:${userId}`));
                
                // Clean up each provider
                await Promise.all(
                  keysToCleanup.map(async (key) => {
                    const provider = this.providers.get(key);
                    if (provider) {
                      await safelyCleanupProvider(
                        () => provider.cleanup(),
                        PROVIDER_CLEANUP_TIMEOUT_MS,
                        operationId
                      );
                      this.providers.delete(key);
                    }
                    this.initStates.delete(key);
                  })
                );
              },
              operationId
            );
          } catch (error) {
            logger.error(
              LogCategory.Provider,
              `Error cleaning up providers for user`,
              operationId,
              userId,
              { error }
            );
          }
        })
      );
      
      // Clear all maps after cleaning up providers
      this.providers.clear();
      this.initStates.clear();
    }
    
    logger.debug(
      LogCategory.Provider,
      `Provider cleanup completed`,
      operationId
    );
  }
}