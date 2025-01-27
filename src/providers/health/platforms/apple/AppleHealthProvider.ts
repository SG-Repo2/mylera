// src/providers/health/platforms/apple/AppleHealthProvider.ts
import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthKitPermissions,
  HealthInputOptions,
} from 'react-native-health';
import { permissions } from './permissions';
import type { HealthProvider, HealthMetrics } from '../../types';

export class AppleHealthProvider implements HealthProvider {
  private initialized = false;

  async initialize(): Promise<void> {
    if (Platform.OS !== 'ios') {
      throw new Error('AppleHealthProvider can only be used on iOS');
    }

    if (this.initialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      AppleHealthKit.initHealthKit(permissions, (error: string) => {
        if (error) {
          reject(new Error(error));
          return;
        }
        this.initialized = true;
        resolve();
      });
    });
  }

  async requestPermissions(): Promise<boolean> {
    try {
      await this.initialize();
      return true;
    } catch (error) {
      console.error('HealthKit permission error:', error);
      return false;
    }
  }

  async checkPermissionsStatus(): Promise<boolean> {
    return new Promise((resolve) => {
      AppleHealthKit.isAvailable((error: Object, available: boolean) => {
        if (error || !available) {
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  async getMetrics(): Promise<HealthMetrics> {
    const now = new Date();
    const options = {
      date: now.toISOString(),
    };

    const steps = await this.getSteps(options);
    
    // This is a minimal implementation - you'll want to add other metrics
    return {
      id: '',
      user_id: '',
      date: now.toISOString().split('T')[0],
      steps: steps,
      distance: null,
      calories: null,
      heart_rate: null,
      daily_score: 0,
      weekly_score: null,
      streak_days: null,
      last_updated: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }

  private async getSteps(options: HealthInputOptions): Promise<number> {
    return new Promise((resolve, reject) => {
      AppleHealthKit.getStepCount(options, (error: string, results: any) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(results.value || 0);
        }
      });
    });
  }
}