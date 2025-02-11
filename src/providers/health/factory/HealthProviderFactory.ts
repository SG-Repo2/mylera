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

  private static initializeProvider(deviceType?: 'os' | 'fitbit'): HealthProvider {
    try {
      this.validatePlatform(deviceType);

      if (deviceType === 'fitbit') {
        this.platform = 'fitbit';
        this.instance = new FitbitHealthProvider();
      } else if (Platform.OS === 'ios') {
        this.platform = 'apple';
        this.instance = new AppleHealthProvider();
      } else {
        this.platform = 'google';
        this.instance = new GoogleHealthProvider();
      }

      return this.instance;
    } catch (error) {
      this.instance = null;
      this.platform = null;
      throw new HealthProviderError(
        `Failed to initialize health provider: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      this.isInitializing = false;
    }
  }

  static getProvider(deviceType?: 'os' | 'fitbit'): HealthProvider {
    if (this.instance) {
      return this.instance;
    }

    if (this.isInitializing) {
      throw new HealthProviderError('Provider initialization already in progress');
    }

    this.isInitializing = true;
    const provider = this.initializeProvider(deviceType);
    return provider;
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
