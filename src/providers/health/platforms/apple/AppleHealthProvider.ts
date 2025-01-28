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

    const [steps, distance, calories, heart_rate] = await Promise.all([
      this.getSteps(options),
      this.getDistance(options),
      this.getCalories(options),
      this.getHeartRate(options),
    ]);
    
    return {
      id: '',
      user_id: '',
      date: now.toISOString().split('T')[0],
      steps,
      distance,
      calories,
      heart_rate,
      daily_score: 0,
      weekly_score: null,
      streak_days: null,
      last_updated: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }

  private async getSteps(options: HealthInputOptions): Promise<number | null> {
    return new Promise((resolve) => {
      AppleHealthKit.getStepCount(options, (error: string, results: any) => {
        if (error) {
          console.error('[AppleHealthProvider] Error reading steps:', error);
          resolve(null);
        } else {
          resolve(results.value || 0);
        }
      });
    });
  }

  private async getDistance(options: HealthInputOptions): Promise<number | null> {
    return new Promise((resolve) => {
      AppleHealthKit.getDistanceWalkingRunning(
        options,
        (err: string, results: { value: number }) => {
          if (err) {
            console.error('[AppleHealthProvider] Error reading distance:', err);
            resolve(null);
          } else {
            const kilometers = (results.value || 0) / 1000;
            resolve(Math.round(kilometers * 100) / 100);
          }
        }
      );
    });
  }

  private async getCalories(options: HealthInputOptions): Promise<number | null> {
    return new Promise((resolve) => {
      AppleHealthKit.getActiveEnergyBurned(
        options,
        (err: string, results: Array<{ value: number }>) => {
          if (err) {
            console.error('[AppleHealthProvider] Error reading calories:', err);
            resolve(null);
          } else {
            const totalCalories = results.reduce((sum, result) => sum + (result.value || 0), 0);
            resolve(Math.round(totalCalories));
          }
        }
      );
    });
  }

  private async getHeartRate(options: HealthInputOptions): Promise<number | null> {
    return new Promise((resolve) => {
      AppleHealthKit.getHeartRateSamples(
        {
          ...options,
          ascending: true,
        },
        (err: string, results: Array<{ value: number }>) => {
          if (err) {
            console.error('[AppleHealthProvider] Error reading heart rate:', err);
            resolve(null);
          } else {
            const validSamples = results.filter(sample =>
              typeof sample.value === 'number' &&
              !isNaN(sample.value) &&
              sample.value > 0 &&
              sample.value < 300
            );

            if (!validSamples.length) {
              resolve(null);
              return;
            }

            const sum = validSamples.reduce((acc, sample) => acc + sample.value, 0);
            resolve(Math.round(sum / validSamples.length));
          }
        }
      );
    });
  }
}