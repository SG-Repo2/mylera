// src/providers/google/GoogleHealthProvider.ts

import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
  getSdkStatus,
} from 'react-native-health-connect';
import type { HealthMetrics, HealthProvider } from '../../types';
import { DateUtils } from '../../../../utils/DateUtils';
import { calculateHealthScore } from '../../../utils/HealthScoring';

/**
 * TypeScript interfaces matching the expected data from Health Connect.
 */
interface StepsRecord {
  count: number;
  startTime: string;
  endTime: string;
}

interface DistanceRecord {
  distance: {
    inMeters: number;
  };
  startTime: string;
  endTime: string;
}

interface CaloriesRecord {
  energy: {
    inKilocalories: number;
  };
  startTime: string;
  endTime: string;
}

interface HeartRateSample {
  beatsPerMinute: number;
}

interface HeartRateRecord {
  samples: HeartRateSample[];
  startTime: string;
  endTime: string;
}

/**
 * GoogleHealthProvider implementation using react-native-health-connect v3.x
 */
export class GoogleHealthProvider implements HealthProvider {
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Ensure Health Connect is initialized before making other calls.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // Start new initialization
    this.initializationPromise = this.performInitialization();
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Perform the actual initialization of Health Connect.
   */
  private async performInitialization(): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('GoogleHealthProvider can only be used on Android');
    }

    console.log('[GoogleHealthProvider] Initializing Health Connect...');
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      throw new Error(`Health Connect not available. Status: ${status}`);
    }

    const isInitialized = await initialize();
    if (!isInitialized) {
      throw new Error('Health Connect initialization failed.');
    }

    this.initialized = true;
    console.log('[GoogleHealthProvider] Health Connect initialized successfully.');
  }

  /**
   * Initialize the provider.
   */
  async initialize(): Promise<void> {
    await this.ensureInitialized();
  }

  /**
   * Request read permissions for Steps, Distance, ActiveCaloriesBurned, and HeartRate.
   */
  async requestPermissions(): Promise<void> {
    await this.ensureInitialized();
    await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'HeartRate' },
    ]);
    console.log('[GoogleHealthProvider] Requested read permissions.');
  }

  /**
   * Check if permissions are granted by attempting a small read.
   */
  async checkPermissionsStatus(): Promise<boolean> {
    try {
      const now = new Date();
      await this.readSteps(
        new Date(now.getTime() - 1 * 60 * 1000).toISOString(), // 1 minute ago
        now.toISOString()
      );
      return true;
    } catch (err) {
      console.warn('[GoogleHealthProvider] checkPermissionsStatus failed:', err);
      return false;
    }
  }

  /**
   * Cleanup the provider.
   */
  async cleanup(): Promise<void> {
    this.initialized = false;
    this.initializationPromise = null;
    console.log('[GoogleHealthProvider] Cleanup complete.');
  }

  /**
   * Fetch all health metrics.
   */
  async getMetrics(): Promise<HealthMetrics> {
    try {
      await this.ensureInitialized();

      const now = new Date();
      const startOfDay = DateUtils.getStartOfDay(now);

      const timeRangeFilter = {
        operator: 'between' as const,
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      };

      console.log('[GoogleHealthProvider] Fetching metrics for:', timeRangeFilter);

      const [steps, distance, calories, heartRate] = await Promise.all([
        this.readSteps(timeRangeFilter.startTime, timeRangeFilter.endTime),
        this.readDistance(timeRangeFilter.startTime, timeRangeFilter.endTime),
        this.readCalories(timeRangeFilter.startTime, timeRangeFilter.endTime),
        this.readHeartRate(timeRangeFilter.startTime, timeRangeFilter.endTime),
      ]);

      const totalSteps = steps.reduce((acc, record) => acc + record.count, 0) || null;
      const totalDistance =
        (distance.reduce((acc, record) => acc + record.distance.inMeters, 0) / 1000) || null; // in km
      const totalCalories =
        calories.reduce(
          (acc, record) => acc + record.energy.inKilocalories,
          0
        ) || null;
      const averageHeartRate = this.calculateAverageHeartRate(heartRate);

      const metrics: HealthMetrics = {
        id: '', // Assign as needed
        user_id: '', // Assign as needed
        date: DateUtils.getLocalDateString(startOfDay),
        steps: totalSteps,
        distance: totalDistance,
        calories: totalCalories,
        heart_rate: averageHeartRate,
        daily_score: calculateHealthScore({
          steps: totalSteps || 0,
          distance: totalDistance || 0,
          calories: totalCalories || 0,
          heart_rate: averageHeartRate || 0,
        }).totalScore,
        weekly_score: null, // Implement as needed
        streak_days: null, // Implement as needed
        last_updated: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      console.log('[GoogleHealthProvider] Metrics retrieved:', metrics);
      return metrics;
    } catch (error) {
      console.error('[GoogleHealthProvider] Error fetching metrics:', error);
      throw error;
    }
  }

  /**
   * Read Steps records within a time range.
   */
  async readSteps(startTime: string, endTime: string): Promise<StepsRecord[]> {
    await this.initialize();
    const response = await readRecords<StepsRecord>({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime,
        endTime,
      },
    });
    console.log('[GoogleHealthProvider] readSteps ->', response.records);
    return response.records.map((r) => r.record);
  }

  /**
   * Read Distance records within a time range.
   */
  async readDistance(startTime: string, endTime: string): Promise<DistanceRecord[]> {
    await this.initialize();
    const response = await readRecords<DistanceRecord>({
      recordType: 'Distance',
      timeRangeFilter: {
        operator: 'between',
        startTime,
        endTime,
      },
    });
    console.log('[GoogleHealthProvider] readDistance ->', response.records);
    return response.records.map((r) => r.record);
  }

  /**
   * Read ActiveCaloriesBurned records within a time range.
   */
  async readCalories(
    startTime: string,
    endTime: string
  ): Promise<CaloriesRecord[]> {
    await this.initialize();
    const response = await readRecords<CaloriesRecord>({
      recordType: 'ActiveCaloriesBurned',
      timeRangeFilter: {
        operator: 'between',
        startTime,
        endTime,
      },
    });
    console.log('[GoogleHealthProvider] readCalories ->', response.records);
    return response.records.map((r) => r.record);
  }

  /**
   * Read HeartRate records within a time range.
   */
  async readHeartRate(
    startTime: string,
    endTime: string
  ): Promise<HeartRateRecord[]> {
    await this.initialize();
    const response = await readRecords<HeartRateRecord>({
      recordType: 'HeartRate',
      timeRangeFilter: {
        operator: 'between',
        startTime,
        endTime,
      },
    });
    console.log('[GoogleHealthProvider] readHeartRate ->', response.records);
    return response.records.map((r) => r.record);
  }

  /**
   * Calculate the average heart rate from HeartRateRecords.
   */
  private calculateAverageHeartRate(records: HeartRateRecord[]): number | null {
    try {
      const allSamples = records.flatMap((r) => r.samples);
      const validSamples = allSamples.filter(
        (s) =>
          s.beatsPerMinute > 0 &&
          s.beatsPerMinute < 300 &&
          !isNaN(s.beatsPerMinute)
      );

      if (validSamples.length === 0) return null;

      const sum = validSamples.reduce((acc, s) => acc + s.beatsPerMinute, 0);
      const avg = sum / validSamples.length;
      console.log('[GoogleHealthProvider] Average Heart Rate:', avg);
      return Math.round(avg);
    } catch (error) {
      console.error('[GoogleHealthProvider] Error calculating average heart rate:', error);
      return null;
    }
  }
}