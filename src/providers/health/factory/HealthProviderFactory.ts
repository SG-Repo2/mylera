import { Platform } from 'react-native';
import { AppleHealthProvider } from '../platforms/apple/AppleHealthProvider';
import { GoogleHealthProvider } from '../platforms/google/GoogleHealthProvider';
import { FitbitHealthProvider } from '../platforms/fitbit/FitbitHealthProvider';
import type { HealthProvider } from '../types';

export type HealthPlatform = 'apple' | 'google' | 'fitbit';

class HealthProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HealthProviderError';
  }
}

export class HealthProviderFactory {
  private static instances: Map<string, HealthProvider> = new Map();
  private static platforms: Map<string, HealthPlatform> = new Map();
  private static initializationQueue: Promise<void> = Promise.resolve();
  private static isInitializing = false;
  private static initializationTimeout = 30000; // 30 seconds timeout

  static async waitForInitialization(): Promise<void> {
    if (this.isInitializing) {
      console.log('[HealthProviderFactory] Waiting for ongoing initialization...');
      const startTime = Date.now();
      
      await new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (!this.isInitializing) {
            clearInterval(checkInterval);
            console.log('[HealthProviderFactory] Initialization completed');
            resolve();
          } else if (Date.now() - startTime > this.initializationTimeout) {
            clearInterval(checkInterval);
            reject(new HealthProviderError('Provider initialization timeout'));
          }
        }, 100);
      });
    }
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

  private static async initializeProvider(deviceType?: 'os' | 'fitbit', userId?: string): Promise<HealthProvider> {
    try {
      // Create and validate provider instance
      const provider = this.createProvider(deviceType);
      console.log('[HealthProviderFactory] Provider instance created successfully');

      // Initialize with retries
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Initialize provider
          await provider.initialize();
          console.log(`[HealthProviderFactory] Provider initialized successfully on attempt ${attempt}`);
          
          // Initialize permissions if userId is provided
          if (userId) {
            console.log('[HealthProviderFactory] Initializing permissions for user:', userId);
            await provider.initializePermissions(userId);
            console.log('[HealthProviderFactory] Permissions initialized successfully');
          }
          
          return provider;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          console.warn(
            `[HealthProviderFactory] Provider initialization attempt ${attempt}/${maxRetries} failed:`,
            lastError.message
          );
          
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt - 1) * 500;
            console.log(`[HealthProviderFactory] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw new HealthProviderError(
        `Failed to initialize provider after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
      );
    } catch (error) {
      throw new HealthProviderError(
        `Failed to initialize health provider: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  static async getProvider(deviceType?: 'os' | 'fitbit', userId?: string): Promise<HealthProvider> {
    const key = this.getInstanceKey(userId, deviceType);
    
    // First check if we have a valid initialized provider
    const existingProvider = this.instances.get(key);
    if (existingProvider) {
      try {
        // Validate the existing provider
        if (typeof existingProvider.initialize === 'function' && 
            typeof existingProvider.initializePermissions === 'function') {
          return existingProvider;
        }
        // If provider is invalid, remove it and create a new one
        this.instances.delete(key);
        this.platforms.delete(key);
      } catch (error) {
        console.warn('[HealthProviderFactory] Error validating existing provider:', error);
        this.instances.delete(key);
        this.platforms.delete(key);
      }
    }

    // Queue initialization to prevent race conditions
    try {
      return await this.initializationQueue.then(async () => {
        if (this.isInitializing) {
          console.log('[HealthProviderFactory] Initialization in progress, waiting...');
          await this.waitForInitialization();
          const provider = this.instances.get(key);
          if (!provider) {
            throw new HealthProviderError('Provider initialization failed');
          }
          return provider;
        }

        this.isInitializing = true;
        console.log('[HealthProviderFactory] Starting provider initialization');

        try {
          const provider = await this.initializeProvider(deviceType, userId);
          this.instances.set(key, provider);
          this.platforms.set(key, this.getPlatformForDevice(deviceType));
          console.log('[HealthProviderFactory] Provider initialized and cached successfully');
          return provider;
        } catch (error) {
          console.error('[HealthProviderFactory] Failed to initialize provider:', error);
          throw error;
        } finally {
          this.isInitializing = false;
        }
      });
    } catch (error) {
      // Clean up any failed initialization state
      this.instances.delete(key);
      this.platforms.delete(key);
      this.isInitializing = false;

      throw new HealthProviderError(
        `Failed to get health provider: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  static getPlatform(userId?: string, deviceType?: 'os' | 'fitbit'): HealthPlatform {
    const key = this.getInstanceKey(userId, deviceType);
    const platform = this.platforms.get(key);
    if (!platform) {
      throw new HealthProviderError('Health provider not initialized');
    }
    return platform;
  }

  static async cleanup(userId?: string): Promise<void> {
    if (userId) {
      // Clean up specific user's provider
      const key = this.getInstanceKey(userId);
      const provider = this.instances.get(key);
      if (provider) {
        try {
          await provider.cleanup();
        } catch (error) {
          throw new HealthProviderError(
            `Failed to cleanup health provider: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        } finally {
          this.instances.delete(key);
          this.platforms.delete(key);
        }
      }
    } else {
      // Clean up all providers
      const cleanupPromises = Array.from(this.instances.entries()).map(async ([key, provider]) => {
        try {
          await provider.cleanup();
        } catch (error) {
          console.error(`Failed to cleanup provider for key ${key}:`, error);
        } finally {
          this.instances.delete(key);
          this.platforms.delete(key);
        }
      });

      await Promise.all(cleanupPromises);
    }
    this.isInitializing = false;
  }
}
