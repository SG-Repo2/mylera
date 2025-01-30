import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthKitPermissions,
  HealthInputOptions,
} from 'react-native-health';
import { permissions, HEALTH_PERMISSIONS } from './permissions';
import { BaseHealthProvider } from '../../types/provider';
import type { 
  HealthMetrics, 
  RawHealthData, 
  RawHealthMetric,
  NormalizedMetric
} from '../../types/metrics';
import { METRIC_UNITS } from '../../types/metrics';
import { MetricType } from '../../../../types/metrics';
import { PermissionState, PermissionStatus } from '../../types/permissions';
import { HealthProviderPermissionError } from '../../types/errors';

export class AppleHealthProvider extends BaseHealthProvider {
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

  async requestPermissions(): Promise<PermissionStatus> {
    if (!this.permissionManager) {
      throw new Error('Permission manager not initialized');
    }

    try {
      await this.initialize();

      // Check if permissions are already granted
      const currentState = await this.checkPermissionsStatus();
      if (currentState.status === 'granted') {
        return 'granted';
      }

      // Request permissions through HealthKit
      return new Promise((resolve) => {
        AppleHealthKit.initHealthKit(permissions, async (error: string) => {
          if (error) {
            await this.permissionManager?.updatePermissionState('denied');
            resolve('denied');
            return;
          }

          // Verify permissions were actually granted
          const available = await this.checkAvailability();
          const status: PermissionStatus = available ? 'granted' : 'denied';
          
          await this.permissionManager?.updatePermissionState(status);
          resolve(status);
        });
      });
    } catch (error) {
      await this.permissionManager?.handlePermissionError(
        'HealthKit',
        error
      );
      return 'denied';
    }
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    if (!this.permissionManager) {
      throw new Error('Permission manager not initialized');
    }

    // First check cached state
    const cachedState = await this.permissionManager.getPermissionState();
    if (cachedState) {
      return cachedState;
    }

    // If no cached state, check current status
    const available = await this.checkAvailability();
    const status: PermissionStatus = available ? 'granted' : 'not_determined';
    
    const state: PermissionState = {
      status,
      lastChecked: Date.now()
    };

    await this.permissionManager.updatePermissionState(status);
    return state;
  }

  private async checkAvailability(): Promise<boolean> {
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

  async handlePermissionDenial(): Promise<void> {
    await super.handlePermissionDenial();
    // Additional platform-specific handling could be added here
  }

  async fetchRawMetrics(
    startDate: Date,
    endDate: Date,
    types: MetricType[]
  ): Promise<RawHealthData> {
    // Check permissions before fetching
    const permissionState = await this.checkPermissionsStatus();
    if (permissionState.status !== 'granted') {
      throw new HealthProviderPermissionError(
        'HealthKit',
        'Permission not granted for health data access'
      );
    }

    await this.ensureInitialized();

    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    const rawData: RawHealthData = {};

    await Promise.all(
      types.map(async (type) => {
        switch (type) {
          case 'steps':
            rawData.steps = await this.fetchStepsRaw(options);
            break;
          case 'distance':
            rawData.distance = await this.fetchDistanceRaw(options);
            break;
          case 'calories':
            rawData.calories = await this.fetchCaloriesRaw(options);
            break;
          case 'heart_rate':
            rawData.heart_rate = await this.fetchHeartRateRaw(options);
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
            value: raw.value * 1000, // Convert km to meters
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
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    
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
      date: now.toISOString().split('T')[0],
      steps,
      distance,
      calories,
      heart_rate,
      exercise: null,  // To be implemented later
      standing: null,  // To be implemented later
      daily_score: 0,
      weekly_score: null,
      streak_days: null,
      last_updated: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }

  private async fetchStepsRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    return new Promise((resolve) => {
      AppleHealthKit.getStepCount(options, (error: string, results: any) => {
        if (error) {
          console.error('[AppleHealthProvider] Error reading steps:', error);
          resolve([]);
        } else {
          resolve([{
            startDate: options.startDate || new Date().toISOString(),
            endDate: options.endDate || new Date().toISOString(),
            value: results.value || 0,
            unit: 'count',
            sourceBundle: 'com.apple.health'
          }]);
        }
      });
    });
  }

  private async fetchDistanceRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    return new Promise((resolve) => {
      AppleHealthKit.getDistanceWalkingRunning(
        options,
        (err: string, results: { value: number }) => {
          if (err) {
            console.error('[AppleHealthProvider] Error reading distance:', err);
            resolve([]);
          } else {
            resolve([{
              startDate: options.startDate || new Date().toISOString(),
              endDate: options.endDate || new Date().toISOString(),
              value: (results.value || 0) / 1000, // Convert to kilometers
              unit: 'kilometers',
              sourceBundle: 'com.apple.health'
            }]);
          }
        }
      );
    });
  }

  private async fetchCaloriesRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    return new Promise((resolve) => {
      // Get both active and basal energy burned
      Promise.all([
        new Promise<any>((resolveActive) => {
          AppleHealthKit.getActiveEnergyBurned(
            options,
            (err: string, results: any) => {
              if (err) {
                console.error('[AppleHealthProvider] Error reading active calories:', err);
                resolveActive({ value: 0 });
              } else {
                resolveActive(results);
              }
            }
          );
        }),
        new Promise<any>((resolveBasal) => {
          AppleHealthKit.getBasalEnergyBurned(
            options,
            (err: string, results: any) => {
              if (err) {
                console.error('[AppleHealthProvider] Error reading basal calories:', err);
                resolveBasal({ value: 0 });
              } else {
                resolveBasal(results);
              }
            }
          );
        })
      ]).then(([activeResults, basalResults]) => {
        const totalCalories = (activeResults.value || 0) + (basalResults.value || 0);
        resolve([{
          startDate: options.startDate || new Date().toISOString(),
          endDate: options.endDate || new Date().toISOString(),
          value: Math.round(totalCalories),
          unit: 'kcal',
          sourceBundle: 'com.apple.health'
        }]);
      });
    });
  }

  private async fetchHeartRateRaw(options: HealthInputOptions): Promise<RawHealthMetric[]> {
    return new Promise((resolve) => {
      AppleHealthKit.getHeartRateSamples(
        {
          ...options,
          ascending: false,
          limit: 100, // Get more samples for better accuracy
        },
        (err: string, results: Array<{ value: number; startDate: string; endDate: string }>) => {
          if (err) {
            console.error('[AppleHealthProvider] Error reading heart rate:', err);
            resolve([]);
          } else {
            // Filter out invalid readings and calculate average
            const validSamples = results
              .filter(sample =>
                typeof sample.value === 'number' &&
                !isNaN(sample.value) &&
                sample.value > 30 && // More realistic minimum heart rate
                sample.value < 220 // Maximum realistic heart rate
              )
              .map(sample => ({
                startDate: sample.startDate,
                endDate: sample.endDate,
                value: Math.round(sample.value),
                unit: 'bpm',
                sourceBundle: 'com.apple.health'
              }));

            if (validSamples.length === 0) {
              resolve([{
                startDate: options.startDate || new Date().toISOString(),
                endDate: options.endDate || new Date().toISOString(),
                value: 0,
                unit: 'bpm',
                sourceBundle: 'com.apple.health'
              }]);
            } else {
              resolve(validSamples);
            }
          }
        }
      );
    });
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