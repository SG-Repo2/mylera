import { Platform } from 'react-native';
import { AppleHealthProvider } from '../platforms/apple/AppleHealthProvider';
import { GoogleHealthProvider } from '../platforms/google/GoogleHealthProvider';
import { FitbitHealthProvider } from '../platforms/fitbit/FitbitHealthProvider';
import type { HealthProvider } from '../types';

export type HealthPlatform = 'apple' | 'google' | 'fitbit';

export enum HealthErrorCode {
  UNSUPPORTED_PLATFORM = 'UNSUPPORTED_PLATFORM',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  PROVIDER_NOT_INITIALIZED = 'PROVIDER_NOT_INITIALIZED',
  INITIALIZATION_IN_PROGRESS = 'INITIALIZATION_IN_PROGRESS',
  CLEANUP_FAILED = 'CLEANUP_FAILED',
}

class HealthProviderError extends Error {
  code: HealthErrorCode;
  details?: Record<string, unknown>;

  constructor(code: HealthErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'HealthProviderError';
    this.code = code;
    this.details = details;
  }

  static getDisplayMessage(error: HealthProviderError): string {
    switch (error.code) {
      case HealthErrorCode.UNSUPPORTED_PLATFORM:
        return 'This platform is not supported. Please try using a supported device.';
      case HealthErrorCode.INITIALIZATION_FAILED:
        return 'Failed to initialize health tracking. Please check your permissions and try again.';
      case HealthErrorCode.PROVIDER_NOT_INITIALIZED:
        return 'Health tracking is not initialized. Please restart the app and try again.';
      case HealthErrorCode.INITIALIZATION_IN_PROGRESS:
        return 'Health tracking is being initialized. Please wait...';
      case HealthErrorCode.CLEANUP_FAILED:
        return 'Failed to cleanup health tracking. Please restart the app.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

export class HealthProviderFactory {
  private static instance: HealthProvider | null = null;
  private static platform: HealthPlatform | null = null;
  private static isInitializing = false;

  private static maxRetries = 3;
  private static retryDelay = 1000; // Base delay in milliseconds

  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static validatePlatform(deviceType?: 'os' | 'fitbit'): void {
    if (deviceType === 'fitbit') {
      return; // Fitbit is platform-independent
    }
    
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      throw new HealthProviderError(
        HealthErrorCode.UNSUPPORTED_PLATFORM,
        `Unsupported platform: ${Platform.OS}`,
        { platform: Platform.OS }
      );
    }
  }

  private static async initializeProvider(
    deviceType?: 'os' | 'fitbit',
    userId?: string
  ): Promise<HealthProvider> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
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

        // Initialize the provider first
        await this.instance.initialize();

        // Then initialize permissions if userId is provided
        if (userId) {
          await this.instance.initializePermissions(userId);
        } else {
          throw new HealthProviderError(
            HealthErrorCode.INITIALIZATION_FAILED,
            'User ID is required for permission initialization',
            { context: 'initializeProvider' }
          );
        }

        return this.instance;
      } catch (error) {
        lastError = error as Error;
        console.error(`Health provider initialization attempt ${attempt} failed:`, error);
        
        if (attempt < this.maxRetries) {
          const backoffDelay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.delay(backoffDelay);
          continue;
        }
      }
    }

    this.instance = null;
    this.platform = null;
    throw new HealthProviderError(
      HealthErrorCode.INITIALIZATION_FAILED,
      `Failed to initialize health provider after ${this.maxRetries} attempts`,
      { lastError: lastError?.message }
    );
  }

  static async getProvider(
    deviceType?: 'os' | 'fitbit',
    userId?: string
  ): Promise<HealthProvider> {
    if (this.instance) {
      // If we already have an instance but userId is different, cleanup and reinitialize
      const currentManager = this.instance.getPermissionManager();
      if (userId && currentManager && currentManager.getUserId() !== userId) {
        await this.cleanup();
      } else {
        return this.instance;
      }
    }

    if (this.isInitializing) {
      throw new HealthProviderError(
        HealthErrorCode.INITIALIZATION_IN_PROGRESS,
        'Provider initialization already in progress'
      );
    }

    this.isInitializing = true;
    try {
      const provider = await this.initializeProvider(deviceType, userId);
      return provider;
    } catch (error) {
      console.error('Failed to get health provider:', error);
      throw error instanceof HealthProviderError ? error : new HealthProviderError(
        HealthErrorCode.INITIALIZATION_FAILED,
        'Failed to get health provider',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      );
    } finally {
      this.isInitializing = false;
    }
  }

  static getPlatform(): HealthPlatform {
    if (!this.platform) {
      throw new HealthProviderError(
        HealthErrorCode.PROVIDER_NOT_INITIALIZED,
        'Health provider not initialized'
      );
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
        HealthErrorCode.CLEANUP_FAILED,
        `Failed to cleanup health provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    } finally {
      this.instance = null;
      this.platform = null;
      this.isInitializing = false;
    }
  }
}
