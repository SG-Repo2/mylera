import { Platform } from 'react-native';
import { AppleHealthProvider } from '../platforms/apple/AppleHealthProvider';
import { GoogleHealthProvider } from '../platforms/google/GoogleHealthProvider';
import type { HealthProvider } from '../types';

export type HealthPlatform = 'apple' | 'google';

export class HealthProviderFactory {
  private static instance: HealthProvider | null = null;

  static getProvider(): HealthProvider {
    if (this.instance) {
      return this.instance;
    }

    if (Platform.OS === 'ios') {
      this.instance = new AppleHealthProvider();
    } else if (Platform.OS === 'android') {
      this.instance = new GoogleHealthProvider();
    } else {
      throw new Error('Unsupported platform for health provider');
    }

    return this.instance;
  }

  static cleanup(): void {
    if (this.instance) {
      this.instance.cleanup();
      this.instance = null;
    }
  }
}