import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';
import { HealthMetrics, HealthProvider } from '../../types';
import { DateUtils } from '../../../../utils/DateUtils';
//import { calculateHealthScore } from '../../../utils/HealthScoring';
import { HEALTH_PERMISSIONS } from './permissions';

interface StepsRecord {
  count: number;
}

interface DistanceRecord {
  distance: {
    inMeters: number;
  };
}

interface CaloriesRecord {
  energy: {
    inKilocalories: number;
  };
}

interface HeartRateRecord {
  samples: Array<{
    beatsPerMinute: number;
  }>;
}

export class GoogleHealthProvider implements HealthProvider {
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

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

  private async performInitialization(): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('GoogleHealthProvider can only be used on Android');
    }

    console.log('[GoogleHealthProvider] Initializing Health Connect...');
    const available = await initialize();
    
    if (!available) {
      throw new Error('Health Connect is not available');
    }

    console.log('[GoogleHealthProvider] Health Connect initialized successfully');
    this.initialized = true;
  }

  async initialize(): Promise<void> {
    await this.ensureInitialized();
  }

  async requestPermissions(): Promise<boolean> {
    try {
      await this.ensureInitialized();

      console.log('[GoogleHealthProvider] Requesting permissions...');
      await requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'Distance' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'read', recordType: 'HeartRate' }
      ]);
      
      await this.verifyPermissions();
      console.log('[GoogleHealthProvider] Permissions granted and verified');
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
          console.log('[GoogleHealthProvider] Health Connect is not available');
          return false;
        }
      }
      
      await this.verifyPermissions();
      return true;
    } catch (error) {
      console.error('[GoogleHealthProvider] Permission check failed:', error);
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

  async cleanup(): Promise<void> {
    this.initialized = false;
    this.initializationPromise = null;
    console.log('[GoogleHealthProvider] Cleanup complete');
  }

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

      const [steps, distance, calories, heart_rate] = await Promise.all([
        this.getSteps(timeRangeFilter),
        this.getDistance(timeRangeFilter),
        this.getCalories(timeRangeFilter),
        this.getHeartRate(timeRangeFilter),
      ]);

      const metrics: HealthMetrics = {
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

      console.log('[GoogleHealthProvider] Metrics retrieved:', metrics);
      return metrics;
    } catch (error) {
      console.error('[GoogleHealthProvider] Error fetching metrics:', error);
      throw error;
    }
  }

  private async getSteps(timeRangeFilter: any): Promise<number | null> {
    try {
      console.log('[GoogleHealthProvider] Reading steps...');
      const response = await readRecords('Steps', { timeRangeFilter });
      const records = response.records as StepsRecord[];
      if (!records.length) return null;
      
      const total = records.reduce((sum, record) => sum + (record.count || 0), 0);
      console.log('[GoogleHealthProvider] Steps total:', total);
      return Math.round(total);
    } catch (error) {
      console.error('[GoogleHealthProvider] Error reading steps:', error);
      return null;
    }
  }

  private async getDistance(timeRangeFilter: any): Promise<number | null> {
    try {
      console.log('[GoogleHealthProvider] Reading distance...');
      const response = await readRecords('Distance', { timeRangeFilter });
      const records = response.records as DistanceRecord[];
      if (!records.length) return null;
      
      const totalMeters = records.reduce((sum, record) => 
        sum + (record.distance?.inMeters || 0), 0);
      const kilometers = totalMeters / 1000;
      console.log('[GoogleHealthProvider] Distance total (km):', kilometers);
      return Math.round(kilometers * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      console.error('[GoogleHealthProvider] Error reading distance:', error);
      return null;
    }
  }

  private async getCalories(timeRangeFilter: any): Promise<number | null> {
    try {
      console.log('[GoogleHealthProvider] Reading calories...');
      const response = await readRecords('ActiveCaloriesBurned', { timeRangeFilter });
      const records = response.records as CaloriesRecord[];
      if (!records.length) return null;
      
      const total = records.reduce((sum, record) => 
        sum + (record.energy?.inKilocalories || 0), 0);
      console.log('[GoogleHealthProvider] Calories total:', total);
      return Math.round(total);
    } catch (error) {
      console.error('[GoogleHealthProvider] Error reading calories:', error);
      return null;
    }
  }

  private async getHeartRate(timeRangeFilter: any): Promise<number | null> {
    try {
      console.log('[GoogleHealthProvider] Reading heart rate...');
      const response = await readRecords('HeartRate', { timeRangeFilter });
      const records = response.records as HeartRateRecord[];
      
      if (!records || !records.length) {
        return null;
      }

      // Get all valid heart rate samples
      const validSamples = records.flatMap(record => 
        record.samples.filter(sample => 
          typeof sample.beatsPerMinute === 'number' &&
          !isNaN(sample.beatsPerMinute) &&
          sample.beatsPerMinute > 0 &&
          sample.beatsPerMinute < 300
        )
      );

      if (!validSamples.length) {
        return null;
      }

      // Calculate average heart rate
      const sum = validSamples.reduce((acc, sample) => acc + sample.beatsPerMinute, 0);
      const average = sum / validSamples.length;
      
      console.log('[GoogleHealthProvider] Heart rate average:', average);
      return Math.round(average);
    } catch (error) {
      console.error('[GoogleHealthProvider] Error reading heart rate:', error);
      return null;
    }
  }
}