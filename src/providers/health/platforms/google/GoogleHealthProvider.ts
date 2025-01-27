// src/providers/health/platforms/google/GoogleHealthProvider.ts
import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
  Permission,
  ReadRecordsOptions,
} from 'react-native-health-connect';
import { HEALTH_PERMISSIONS } from './permissions';
import type { HealthProvider, HealthMetrics } from '../../types';

/**
 * Define your own interface for "Steps" records
 * since react-native-health-connect doesn't export a built-in type.
 */
interface StepsRecord {
  startTime: Date;
  endTime: Date;
  count: number;
  // Add additional fields if needed
}

export class GoogleHealthProvider implements HealthProvider {
  private initialized = false;

  async initialize(): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('GoogleHealthProvider can only be used on Android');
    }

    if (this.initialized) {
      return;
    }

    const available = await initialize();
    if (!available) {
      throw new Error('Health Connect is not available');
    }

    this.initialized = true;
  }

  /**
   * Request permissions required by Health Connect.
   * According to the latest library docs, this returns a boolean indicating
   * whether ALL permissions were granted.
   */
  async requestPermissions(): Promise<boolean> {
    try {
      await this.initialize();
      // requestPermission returns boolean: true if all were granted, false otherwise.
      const allGranted: boolean = await requestPermission(HEALTH_PERMISSIONS);
      return allGranted;
    } catch (error) {
      console.error('Health Connect permission error:', error);
      return false;
    }
  }

  /**
   * For a more robust check, you'd call getGrantedPermissions() or similar
   * (if the library supports it) to verify each permission. For now, returning true
   * if initialization doesn't throw.
   */
  async checkPermissionsStatus(): Promise<boolean> {
    try {
      await this.initialize();
      return true;
    } catch {
      return false;
    }
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }

  /**
   * Retrieves "steps" (and in the future, other metrics) for the current day.
   */
  async getMetrics(): Promise<HealthMetrics> {
    const now = new Date();
    const steps = await this.getSteps();

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

  private async getSteps(): Promise<number> {
    try {
      // Build a date range for "today"
      const startTime = new Date(new Date().setHours(0, 0, 0, 0));
      const endTime = new Date(new Date().setHours(23, 59, 59, 999));

      const options: ReadRecordsOptions = {
        timeRangeFilter: { startTime, endTime },
      };

      /**
       * readRecords returns T[] if you pass a generic type parameter.
       * We pass `StepsRecord` so TypeScript knows the shape of each item.
       */
      const records = await readRecords<StepsRecord>('Steps', options);

      // Type the reducer parameters to avoid implicit 'any'.
      const totalSteps = records.reduce<number>(
        (sum: number, record: StepsRecord) => sum + (record.count ?? 0),
        0
      );

      return totalSteps;
    } catch (error) {
      console.error('Error reading steps:', error);
      return 0;
    }
  }
}