import { Platform } from 'react-native';
import { AppleHealthProvider } from '../platforms/apple/AppleHealthProvider';
import { GoogleHealthProvider } from '../platforms/google/GoogleHealthProvider';
import { FitbitHealthProvider } from '../platforms/fitbit/FitbitHealthProvider';
import type { HealthProvider } from '../types';
import { Mutex } from 'async-mutex';
import { HealthProviderError, HealthProviderInitializationError } from '../types/errors';

export type HealthPlatform = 'apple' | 'google' | 'fitbit';

interface InitializationMetrics {
  attempts: number;
  lastAttempt: number;
  errors: Array<{ timestamp: number; error: string }>;
}

export class HealthProviderFactory {
  private static instances: Map<string, HealthProvider> = new Map();
  private static platforms: Map<string, HealthPlatform> = new Map();
  private static initializationQueue = new Map<string, Promise<void>>();
  private static initializationMetrics = new Map<string, InitializationMetrics>();
  private static initializationMutex = new Mutex();
  private static isInitializing = false;
  private static initializationTimeout = 30000; // 30 seconds timeout
  private static maxRetries = 3;
  private static retryDelay = 1000; // Base delay in ms

  private static logInitializationMetric(key: string, error?: Error): void {
    const metrics = this.initializationMetrics.get(key) || {
      attempts: 0,
      lastAttempt: 0,
      errors: []
    };

    metrics.attempts++;
    metrics.lastAttempt = Date.now();
    if (error) {
      metrics.errors.push({
        timestamp: Date.now(),
        error: error.message
      });
    }

    this.initializationMetrics.set(key, metrics);
    
    // Log metrics for monitoring
    console.log('[HealthProviderFactory] Initialization metrics:', {
      key,
      metrics,
      currentAttempt: metrics.attempts,
      timeSinceLastAttempt: Date.now() - metrics.lastAttempt
    });
  }

  private static getInstanceKey(userId?: string, deviceType?: 'os' | 'fitbit'): string {
    return `${userId || 'default'}:${deviceType || 'os'}`;
  }

  private static validatePlatform(deviceType?: 'os' | 'fitbit'): void {
    if (deviceType === 'fitbit') {
      return; // Fitbit is platform-independent
    }
    
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      throw new HealthProviderError(`Unsupported platform: ${Platform.OS}`);
    }
  }

  private static getPlatformForDevice(deviceType?: 'os' | 'fitbit'): HealthPlatform {
    if (deviceType === 'fitbit') {
      return 'fitbit';
    }
    return Platform.OS === 'ios' ? 'apple' : 'google';
  }

  private static createProvider(deviceType?: 'os' | 'fitbit'): HealthProvider {
    this.validatePlatform(deviceType);

    let provider: HealthProvider;
    try {
      if (deviceType === 'fitbit') {
        provider = new FitbitHealthProvider();
      } else if (Platform.OS === 'ios') {
        provider = new AppleHealthProvider();
      } else {
        provider = new GoogleHealthProvider();
      }

      // Validate provider before returning
      if (!provider) {
        throw new HealthProviderError('Provider instance creation failed');
      }

      if (typeof provider.initialize !== 'function') {
        throw new HealthProviderError('Provider missing required initialize method');
      }

      if (typeof provider.cleanup !== 'function') {
        throw new HealthProviderError('Provider missing required cleanup method');
      }

      if (typeof provider.getMetrics !== 'function') {
        throw new HealthProviderError('Provider missing required getMetrics method');
      }

      return provider;
    } catch (error) {
      throw new HealthProviderError(
        `Failed to create valid provider: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private static async queueInitialization(
    key: string, 
    initFn: () => Promise<void>
  ): Promise<void> {
    const existing = this.initializationQueue.get(key);
    if (existing) {
      console.log('[HealthProviderFactory] Waiting for existing initialization:', key);
      return existing;
    }

    const promise = (async () => {
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          this.logInitializationMetric(key);
          await initFn();
          console.log(`[HealthProviderFactory] Initialization successful for ${key} on attempt ${attempt}`);
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          this.logInitializationMetric(key, lastError);
          
          if (attempt < this.maxRetries) {
            const delay = this.retryDelay * Math.pow(2, attempt - 1);
            console.log(`[HealthProviderFactory] Retrying initialization for ${key} in ${delay}ms (attempt ${attempt}/${this.maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw new HealthProviderInitializationError(
        key,
        `Failed after ${this.maxRetries} attempts: ${lastError?.message}`
      );
    })();

    this.initializationQueue.set(key, promise);
    
    try {
      await promise;
    } finally {
      // Clean up the queue entry only if it's the same promise
      if (this.initializationQueue.get(key) === promise) {
        this.initializationQueue.delete(key);
      }
    }
  }

  static async getProvider(deviceType?: 'os' | 'fitbit', userId?: string): Promise<HealthProvider> {
    const key = this.getInstanceKey(userId, deviceType);

    // Use mutex to ensure sequential initialization
    return this.initializationMutex.runExclusive(async () => {
      // Check if there's already a provider instance
      const existingProvider = this.instances.get(key);
      if (existingProvider) {
        return existingProvider;
      }

      // Check if there's a pending initialization
      const pendingInit = this.initializationQueue.get(key);
      if (pendingInit) {
        console.log('[HealthProviderFactory] Waiting for existing initialization:', key);
        await pendingInit;
        const provider = this.instances.get(key);
        if (provider) return provider;
      }

      // Create new provider instance
      const provider = this.createProvider(deviceType);
      this.instances.set(key, provider);
      this.platforms.set(key, this.getPlatformForDevice(deviceType));

      // Create initialization promise
      const initPromise = this.queueInitialization(key, async () => {
        await provider.initialize();
      });

      this.initializationQueue.set(key, initPromise);

      try {
        await initPromise;
        return provider;
      } catch (error) {
        // Clean up failed initialization
        this.instances.delete(key);
        this.platforms.delete(key);
        throw error;
      } finally {
        this.initializationQueue.delete(key);
      }
    });
  }

  static getPlatform(userId?: string, deviceType?: 'os' | 'fitbit'): HealthPlatform {
    const key = this.getInstanceKey(userId, deviceType);
    const platform = this.platforms.get(key);
    if (!platform) {
      throw new HealthProviderError('Health provider not initialized');
    }
    return platform;
  }

  static async cleanup(specificKey?: string): Promise<void> {
    return this.initializationMutex.runExclusive(async () => {
      const cleanupPromises: Promise<void>[] = [];

      if (specificKey) {
        // Cleanup specific provider instance
        const provider = this.instances.get(specificKey);
        if (provider) {
          console.log(`[HealthProviderFactory] Cleaning up specific provider: ${specificKey}`);
          try {
            await provider.cleanup();
            this.instances.delete(specificKey);
            this.platforms.delete(specificKey);
            this.initializationQueue.delete(specificKey);
            this.initializationMetrics.delete(specificKey);
          } catch (error) {
            console.error(`[HealthProviderFactory] Error during cleanup for ${specificKey}:`, error);
            throw new HealthProviderError(`Cleanup failed for ${specificKey}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          return;
        }
      } else {
        // Full cleanup of all providers
        console.log('[HealthProviderFactory] Starting full cleanup');
        
        for (const [key, provider] of this.instances) {
          try {
            console.log(`[HealthProviderFactory] Cleaning up provider: ${key}`, {
              platform: this.platforms.get(key),
              hasInitQueue: this.initializationQueue.has(key),
              metrics: this.initializationMetrics.get(key)
            });
            
            cleanupPromises.push(
              provider.cleanup().catch(error => {
                console.error(`[HealthProviderFactory] Error during cleanup for ${key}:`, error);
                // Continue cleanup process despite errors
                return Promise.resolve();
              })
            );
          } catch (error) {
            console.error(`[HealthProviderFactory] Error queueing cleanup for ${key}:`, error);
          }
        }

        await Promise.all(cleanupPromises);
        
        // Clear all maps only after successful cleanup
        this.instances.clear();
        this.platforms.clear();
        this.initializationQueue.clear();
        this.initializationMetrics.clear();
        
        console.log('[HealthProviderFactory] Full cleanup completed');
      }
    });
  }
}
