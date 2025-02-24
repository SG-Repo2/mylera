import { Platform } from 'react-native';
import { AppleHealthProvider } from '../platforms/apple/AppleHealthProvider';
import { GoogleHealthProvider } from '../platforms/google/GoogleHealthProvider';
import { FitbitHealthProvider } from '../platforms/fitbit/FitbitHealthProvider';
import type { HealthProvider } from '../types/provider';
import { Mutex } from 'async-mutex';
import { HealthProviderError } from '../types/errors';
import { logger, LogCategory } from '../../../utils/logger';
import type { ProviderManagerInterface, ProviderState } from '../types/state';
import { initializeProviderWithRetry } from '../../../utils/providerInitializationManager';

export type HealthPlatform = 'apple' | 'google' | 'fitbit';

export class HealthProviderFactory implements ProviderManagerInterface {
  private static instance: HealthProviderFactory;
  private providers: Map<string, HealthProvider>;
  private states: Map<string, ProviderState>;
  private mutex: Mutex;

  private constructor() {
    this.providers = new Map();
    this.states = new Map();
    this.mutex = new Mutex();
  }

  static getInstance(): HealthProviderFactory {
    if (!this.instance) {
      this.instance = new HealthProviderFactory();
    }
    return this.instance;
  }

  private createProviderInstance(platform: HealthPlatform): HealthProvider {
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

  async initializeProvider(userId: string, platform: HealthPlatform): Promise<HealthProvider> {
    return this.mutex.runExclusive(async () => {
      logger.debug(
        LogCategory.Health,
        'Initializing provider',
        userId,
        undefined,
        { platform }
      );

      // Cleanup any existing provider
      await this.cleanupProvider(userId);

      // Create new provider instance
      const provider = this.createProviderInstance(platform);
      this.states.set(userId, { status: 'initializing', userId });

      try {
        // Initialize permissions first
        await provider.initializePermissions(userId);
        
        // Use the new initialization manager
        await initializeProviderWithRetry(provider, {
          operationId: `init-${userId}-${Date.now()}`,
          maxRetries: 2
        });

        if (!provider.isInitialized()) {
          throw new HealthProviderError('Provider initialization verification failed');
        }

        // Store provider and update state
        this.providers.set(userId, provider);
        this.states.set(userId, { status: 'ready', userId });

        logger.debug(
          LogCategory.Health,
          'Provider initialized',
          userId,
          undefined,
          { platform }
        );
        return provider;
      } catch (error) {
        // Remove provider and set error state
        this.providers.delete(userId);
        this.states.set(userId, { 
          status: 'error', 
          userId, 
          error: error instanceof Error ? error : new Error('Unknown error') 
        });
        
        throw error;
      }
    });
  }

  async cleanupProvider(userId: string): Promise<void> {
    return this.mutex.runExclusive(async () => {
      const provider = this.providers.get(userId);
      if (provider) {
        logger.debug(
          LogCategory.Health,
          'Cleaning up provider',
          userId,
          undefined,
          {}
        );
        this.states.set(userId, { status: 'cleaning', userId });

        try {
          await provider.cleanup();
          this.providers.delete(userId);
          this.states.delete(userId);
          logger.debug(
            LogCategory.Health,
            'Provider cleanup complete',
            userId,
            undefined,
            {}
          );
        } catch (error) {
          this.states.set(userId, {
            status: 'error',
            userId,
            error: error instanceof Error ? error : new Error('Unknown error')
          });
          logger.error(
            LogCategory.Health,
            'Provider cleanup failed',
            userId,
            undefined,
            { error }
          );
          throw error;
        }
      }
    });
  }

  getProvider(userId: string): HealthProvider | undefined {
    return this.providers.get(userId);
  }
}
