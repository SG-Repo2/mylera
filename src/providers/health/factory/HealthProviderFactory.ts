import { Platform } from 'react-native';
import { AppleHealthProvider } from '../platforms/apple/AppleHealthProvider';
import { GoogleHealthProvider } from '../platforms/google/GoogleHealthProvider';
import { FitbitHealthProvider } from '../platforms/fitbit/FitbitHealthProvider';
import type { HealthProvider } from '../types';
import { Mutex } from 'async-mutex';
import { HealthProviderError, HealthProviderInitializationError } from '../types/errors';
import { logger, LogCategory } from '../../../utils/logger';
import { initializeProviderWithRetry } from '../../../utils/providerInitializationManager';

export type HealthPlatform = 'apple' | 'google' | 'fitbit';

interface ProviderInitState {
  provider: HealthProvider;
  initPromise: Promise<void>;
}

export class HealthProviderFactory {
  private static instances = new Map<string, HealthProvider>();
  private static initStates = new Map<string, ProviderInitState>();
  private static mutex = new Mutex();

  private static createProviderInstance(platform: HealthPlatform): HealthProvider {
    switch (platform) {
      case 'apple':
        if (Platform.OS !== 'ios') throw new HealthProviderError('Apple Health is only available on iOS');
        return new AppleHealthProvider();
      case 'google':
        if (Platform.OS !== 'android') throw new HealthProviderError('Google Health is only available on Android');
        return new GoogleHealthProvider();
      case 'fitbit':
        return new FitbitHealthProvider();
      default:
        throw new HealthProviderError(`Unsupported platform: ${platform}`);
    }
  }

  private static async initializeProvider(
    provider: HealthProvider,
    platform: HealthPlatform,
    userId: string,
    key: string
  ): Promise<void> {
    try {
      // Set userId before any initialization
      await provider.setUserId(userId);
      
      await initializeProviderWithRetry(provider, {
        operationId: key,
        maxRetries: 2
      });
      
      await provider.initializePermissions(userId);
      this.instances.set(key, provider);
    } catch (error) {
      await this.cleanup(key);
      throw error;
    } finally {
      this.initStates.delete(key);
    }
  }

  static async getProvider(platform: HealthPlatform, userId: string): Promise<HealthProvider> {
    if (!platform) {
      throw new HealthProviderError('Platform must be specified');
    }
    if (!userId) {
      throw new HealthProviderError('UserId must be specified');
    }

    return this.mutex.runExclusive(async () => {
      const key = `${platform}:${userId}`;
      console.log('[HealthProviderFactory] Getting provider for:', { platform, userId, key });

      // Return existing initialized provider
      const existingProvider = this.instances.get(key);
      if (existingProvider) {
        console.log('[HealthProviderFactory] Returning existing provider');
        return existingProvider;
      }

      // Create new provider
      const provider = this.createProviderInstance(platform);
      
      // Set userId immediately after creation
      await provider.setUserId(userId);

      // Initialize the provider
      const initPromise = this.initializeProvider(provider, platform, userId, key);
      this.initStates.set(key, { provider, initPromise });
      
      await initPromise;
      return provider;
    });
  }

  static async cleanup(key?: string): Promise<void> {
    return this.mutex.runExclusive(async () => {
      if (key) {
        // Cleanup specific provider
        const provider = this.instances.get(key);
        if (provider) {
          await provider.cleanup();
          this.instances.delete(key);
        }
        this.initStates.delete(key);
      } else {
        // Cleanup all providers
        await Promise.all(
          Array.from(this.instances.values()).map(provider => 
            provider.cleanup().catch(error => {
              logger.error(
                LogCategory.Health,
                'Error during provider cleanup',
                undefined,
                undefined,
                { error }
              );
            })
          )
        );
        this.instances.clear();
        this.initStates.clear();
      }
    });
  }
}
