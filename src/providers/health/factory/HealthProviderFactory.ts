import { Platform } from 'react-native';
import { AppleHealthProvider } from '../platforms/apple/AppleHealthProvider';
import { GoogleHealthProvider } from '../platforms/google/GoogleHealthProvider';
import type { HealthProvider } from '../types';

export type HealthPlatform = 'apple' | 'google';

// factory/HealthProviderFactory.ts
export class HealthProviderFactory {
  private static instance: HealthProvider | null = null;
  private static platform: HealthPlatform | null = null;

  static getProvider(): HealthProvider {
    if (this.instance) {
      return this.instance;
    }

    if (Platform.OS === 'ios') {
      this.platform = 'apple';
      this.instance = new AppleHealthProvider();
    } else if (Platform.OS === 'android') {
      this.platform = 'google';
      this.instance = new GoogleHealthProvider();
    } else {
      throw new Error('Unsupported platform for health provider');
    }

    return this.instance;
  }

  static getPlatform(): HealthPlatform {
    if (!this.platform) {
      throw new Error('Health provider not initialized');
    }
    return this.platform;
  }

  static async cleanup(): Promise<void> {
    if (this.instance) {
      await this.instance.cleanup();
      this.instance = null;
      this.platform = null;
    }
  }
}