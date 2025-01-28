import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';
import { BaseHealthProvider } from '../../types/provider';
import { 
  HealthMetrics, 
  RawHealthData, 
  RawHealthMetric,
  NormalizedMetric,
  METRIC_UNITS 
} from '../../types/metrics';
import { MetricType } from '../../../../types/metrics';
import { DateUtils } from '../../../../utils/DateUtils';

interface StepsRecord {
  startTime: string;
  endTime: string;
  count: number;
}

interface DistanceRecord {
  startTime: string;
  endTime: string;
  distance: {
    inMeters: number;
  };
}

interface CaloriesRecord {
  startTime: string;
  endTime: string;
  energy: {
    inKilocalories: number;
  };
}

interface HeartRateRecord {
  startTime: string;
  endTime: string;
  samples: Array<{
    beatsPerMinute: number;
  }>;
}

export class GoogleHealthProvider extends BaseHealthProvider {
  private initializationPromise: Promise<void> | null = null;

  private async performInitialization(): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('GoogleHealthProvider can only be used on Android');
    }

    const available = await initialize();
    
    if (!available) {
      throw new Error('Health Connect is not available');
    }

    this.initialized = true;
  }

  async initialize(): Promise<void> {
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

  async requestPermissions(): Promise<boolean> {
    try {
      await this.ensureInitialized();

      await requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'Distance' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'read', recordType: 'HeartRate' }
      ]);
      
      await this.verifyPermissions();
      return true;
    } catch (error) {
      console.error('[GoogleHealthProvider] Permission request failed:', error);
      return false;
    }
  }

  async checkPermissionsStatus(): Promise<boolean> {
    try {
      if (!this.initialized) {
        const available = await initialize();
        if (!available) {
          return false;
        }
      }
      
      await this.verifyPermissions();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async verifyPermissions(): Promise<void> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const testRange = {
      operator: 'between' as const,
      startTime: DateUtils.getStartOfDay(yesterday).toISOString(),
      endTime: now.toISOString(),
    };
    
    await Promise.all([
      readRecords('Steps', { timeRangeFilter: testRange }),
      readRecords('Distance', { timeRangeFilter: testRange }),
      readRecords('ActiveCaloriesBurned', { timeRangeFilter: testRange }),
      readRecords('HeartRate', { timeRangeFilter: testRange })
    ]);
  }

  async fetchRawMetrics(
    startDate: Date,
    endDate: Date,
    types: MetricType[]
  ): Promise<RawHealthData> {
    await this.ensureInitialized();

    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };

    const rawData: RawHealthData = {};

    await Promise.all(
      types.map(async (type) => {
        switch (type) {
          case 'steps':
            const stepsResponse = await readRecords('Steps', { timeRangeFilter });
            rawData.steps = (stepsResponse.records as StepsRecord[]).map(record => ({
              startDate: record.startTime,
              endDate: record.endTime,
              value: record.count,
              unit: 'count',
              sourceBundle: 'com.google.android.apps.fitness'
            }));
            break;

          case 'distance':
            const distanceResponse = await readRecords('Distance', { timeRangeFilter });
            rawData.distance = (distanceResponse.records as DistanceRecord[]).map(record => ({
              startDate: record.startTime,
              endDate: record.endTime,
              value: record.distance.inMeters,
              unit: 'meters',
              sourceBundle: 'com.google.android.apps.fitness'
            }));
            break;

          case 'calories':
            const caloriesResponse = await readRecords('ActiveCaloriesBurned', { timeRangeFilter });
            rawData.calories = (caloriesResponse.records as CaloriesRecord[]).map(record => ({
              startDate: record.startTime,
              endDate: record.endTime,
              value: record.energy.inKilocalories,
              unit: 'kcal',
              sourceBundle: 'com.google.android.apps.fitness'
            }));
            break;

          case 'heart_rate':
            const heartRateResponse = await readRecords('HeartRate', { timeRangeFilter });
            rawData.heart_rate = (heartRateResponse.records as HeartRateRecord[]).flatMap(record =>
              record.samples.map(sample => ({
                startDate: record.startTime,
                endDate: record.endTime,
                value: sample.beatsPerMinute,
                unit: 'bpm',
                sourceBundle: 'com.google.android.apps.fitness'
              }))
            );
            break;
        }
      })
    );

    return rawData;
  }

  normalizeMetrics(rawData: RawHealthData, type: MetricType): NormalizedMetric[] {
    const metrics: NormalizedMetric[] = [];

    switch (type) {
      case 'steps':
        if (rawData.steps) {
          metrics.push(...rawData.steps.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.STEPS,
            type: 'steps'
          } as NormalizedMetric)));
        }
        break;

      case 'distance':
        if (rawData.distance) {
          metrics.push(...rawData.distance.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.DISTANCE,
            type: 'distance'
          } as NormalizedMetric)));
        }
        break;

      case 'calories':
        if (rawData.calories) {
          metrics.push(...rawData.calories.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.CALORIES,
            type: 'calories'
          } as NormalizedMetric)));
        }
        break;

      case 'heart_rate':
        if (rawData.heart_rate) {
          metrics.push(...rawData.heart_rate.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.HEART_RATE,
            type: 'heart_rate'
          } as NormalizedMetric)));
        }
        break;
    }

    return metrics;
  }

  async getMetrics(): Promise<HealthMetrics> {
    try {
      const now = new Date();
      const startOfDay = DateUtils.getStartOfDay(now);
      
      const rawData = await this.fetchRawMetrics(
        startOfDay,
        now,
        ['steps', 'distance', 'calories', 'heart_rate']
      );

      // Normalize and aggregate the data
      const steps = this.aggregateMetric(this.normalizeMetrics(rawData, 'steps'));
      const distance = this.aggregateMetric(this.normalizeMetrics(rawData, 'distance'));
      const calories = this.aggregateMetric(this.normalizeMetrics(rawData, 'calories'));
      const heart_rate = this.aggregateMetric(this.normalizeMetrics(rawData, 'heart_rate'));

      return {
        id: '',
        user_id: '',
        date: DateUtils.getLocalDateString(startOfDay),
        steps,
        distance,
        calories,
        heart_rate,
        daily_score: 0,
        weekly_score: null,
        streak_days: null,
        last_updated: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      };
    } catch (error) {
      console.error('[GoogleHealthProvider] Error fetching metrics:', error);
      throw error;
    }
  }

  private aggregateMetric(metrics: NormalizedMetric[]): number | null {
    if (!metrics.length) return null;

    switch (metrics[0].type) {
      case 'heart_rate':
        // Average for heart rate
        return Math.round(
          metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
        );
      default:
        // Sum for other metrics
        return Math.round(
          metrics.reduce((sum, m) => sum + m.value, 0)
        );
    }
  }
}