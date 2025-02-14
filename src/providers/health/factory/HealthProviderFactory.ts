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
  private static instance: HealthProvider | null = null;
  private static platform: HealthPlatform | null = null;
  private static isInitializing = false;

  private static validatePlatform(deviceType?: 'os' | 'fitbit'): void {
    if (deviceType === 'fitbit') {
      return; // Fitbit is platform-independent
    }
    
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      throw new HealthProviderError(`Unsupported platform: ${Platform.OS}`);
    }
  }

  private static async initializeProvider(deviceType?: 'os' | 'fitbit'): Promise<HealthProvider> {
    try {
      let provider: HealthProvider;
      
      if (Platform.OS === 'ios') {
        provider = new AppleHealthProvider();
      } else if (Platform.OS === 'android') {
        provider = new GoogleHealthProvider();
      } else {
        throw new HealthProviderError('Unsupported platform');
      }

      // Ensure provider is properly instantiated before initialization
      if (!provider || typeof provider.initialize !== 'function') {
        throw new HealthProviderError('Invalid provider instance');
      }

      await provider.initialize();
      this.instance = provider;
      return provider;
    } catch (error) {
      console.error('[HealthProviderFactory] Provider initialization failed:', error);
      throw error;
    }
  }

  static async getProvider(deviceType?: 'os' | 'fitbit'): Promise<HealthProvider> {
    try {
      if (this.instance) {
        return this.instance;
      }

      if (this.isInitializing) {
        throw new HealthProviderError('Provider initialization already in progress');
      }

      this.isInitializing = true;
      const provider = await this.initializeProvider(deviceType);
      
      // Initialize permissions immediately after provider creation
      if (provider) {
        await provider.initialize();
      }
      
      return provider;
    } catch (error) {
      console.error('[HealthProviderFactory] Error getting provider:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  static getPlatform(): HealthPlatform {
    if (!this.platform) {
      throw new HealthProviderError('Health provider not initialized');
    }
    return this.platform;
  }

  static async cleanup(): Promise<void> {
    if (!this.instance) {
      return;
    }

    try {
      await this.instance.cleanup();
    } catch (error) {
      throw new HealthProviderError(
        `Failed to cleanup health provider: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      this.instance = null;
      this.platform = null;
      this.isInitializing = false;
    }
  }
}
