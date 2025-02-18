import { MockFactory } from './mockFactory';
import {
  MockFactoryConfig,
  HealthProviderMockConfig,
  SupabaseMockConfig,
  MetricsServiceMockConfig,
  HealthMetricsMockConfig,
  MockValidationResult,
} from '../types/mockTypes';
import { TestHealthData, TestUser, TestSession, TestErrorResponse } from '../types/test.types';
import { HealthProvider } from '@/src/providers/health/types';

type MockEventHandler = (...args: any[]) => void;

interface MockSubscription {
  unsubscribe: jest.Mock;
  handlers: Map<string, MockEventHandler[]>;
}

export class EnhancedMockFactory extends MockFactory {
  private static validateHealthData(data: TestHealthData): MockValidationResult {
    const errors: string[] = [];
    
    if (data.steps && (data.steps < 0 || data.steps > 100000)) {
      errors.push('Steps value out of valid range (0-100000)');
    }
    if (data.heart_rate && (data.heart_rate < 30 || data.heart_rate > 220)) {
      errors.push('Heart rate value out of valid range (30-220)');
    }
    if (data.daily_score && (data.daily_score < 0 || data.daily_score > 100)) {
      errors.push('Daily score must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private static validateConfig(config: MockFactoryConfig): MockValidationResult {
    const errors: string[] = [];

    if (config.healthProvider?.healthData) {
      const healthDataValidation = this.validateHealthData(config.healthProvider.healthData);
      errors.push(...healthDataValidation.errors);
    }

    if (config.metricsService?.trendData) {
      for (const [metric, data] of Object.entries(config.metricsService.trendData)) {
        if (!['increasing', 'decreasing', 'stable'].includes(data.trend)) {
          errors.push(`Invalid trend value for ${metric}`);
        }
        if (data.consistency < 0 || data.consistency > 1) {
          errors.push(`Consistency value for ${metric} must be between 0 and 1`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create an enhanced mock health provider with configurable behavior
   */
  static createEnhancedHealthProvider(config: HealthProviderMockConfig = {}): HealthProvider {
    const baseProvider = super.createTestHealthProvider();
    const {
      isAvailable = true,
      initializationError,
      permissionStatus = 'granted',
      healthData,
      rawData,
      syncTime = new Date()
    } = config;

    if (healthData) {
      const validation = this.validateHealthData(healthData);
      if (!validation.isValid) {
        throw new Error(`Invalid health data: ${validation.errors.join(', ')}`);
      }
    }

    return {
      ...baseProvider,
      initialize: initializationError 
        ? jest.fn().mockRejectedValue(initializationError)
        : jest.fn().mockResolvedValue(undefined),
      isAvailable: jest.fn().mockResolvedValue(isAvailable),
      checkPermissionsStatus: jest.fn().mockResolvedValue({ status: permissionStatus }),
      getMetrics: jest.fn().mockResolvedValue(healthData || super.createTestHealthData('test-user-123')),
      fetchRawMetrics: jest.fn().mockResolvedValue(rawData || {}),
      getLastSyncTime: jest.fn().mockResolvedValue(syncTime)
    };
  }

  /**
   * Create an enhanced Supabase mock with configurable behavior
   */
  static createEnhancedSupabaseMock(config: SupabaseMockConfig = {}) {
    const subscriptions = new Map<string, MockSubscription>();

    return {
      auth: {
        signUp: jest.fn().mockResolvedValue(
          config.auth?.signUpError
            ? { data: null, error: config.auth.signUpError }
            : { data: { user: config.auth?.user || super.createTestUser() }, error: null }
        ),
        signInWithPassword: jest.fn().mockResolvedValue(
          config.auth?.signInError
            ? { data: null, error: config.auth.signInError }
            : { 
                data: { 
                  session: config.auth?.session || super.createTestSession(config.auth?.user || super.createTestUser())
                }, 
                error: null 
              }
        )
      },
      from: (table: string) => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        match: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        data: config.data?.[table] || null,
        error: null
      }),
      channel: (name: string) => {
        if (!subscriptions.has(name)) {
          subscriptions.set(name, {
            unsubscribe: jest.fn(),
            handlers: new Map()
          });
        }

        return {
          on: (event: string, callback: Function) => {
            const subscription = subscriptions.get(name)!;
            if (!subscription.handlers.has(event)) {
              subscription.handlers.set(event, []);
            }
            subscription.handlers.get(event)!.push(callback as MockEventHandler);

            return {
              subscribe: jest.fn(() => ({
                unsubscribe: subscription.unsubscribe
              }))
            };
          },
          subscribe: jest.fn(() => ({
            unsubscribe: subscriptions.get(name)!.unsubscribe
          }))
        };
      }
    };
  }

  /**
   * Create an enhanced metrics service mock with configurable behavior
   */
  static createEnhancedMetricsServiceMock(config: MetricsServiceMockConfig = {}) {
    return {
      calculateMetrics: jest.fn().mockImplementation((metric: string) => {
        if (config.calculationErrors?.[metric]) {
          throw config.calculationErrors[metric];
        }
        return config.initialMetrics || super.createTestHealthData('test-user-123');
      }),
      analyzeTrends: jest.fn().mockImplementation((metric: string) => {
        return config.trendData?.[metric] || {
          trend: 'stable',
          consistency: 0.75
        };
      })
    };
  }

  /**
   * Create an enhanced health metrics mock with configurable behavior
   */
  static createEnhancedHealthMetricsMock(config: HealthMetricsMockConfig = {}) {
    return {
      defaultGoals: {
        steps: 10000,
        distance: 8000,
        calories: 2500,
        heart_rate: 75,
        exercise: 45,
        ...config.defaultGoals
      },
      adjustmentFactors: {
        steps: 1.1,
        distance: 1.1,
        calories: 1.1,
        heart_rate: 1.0,
        exercise: 1.1,
        ...config.adjustmentFactors
      },
      validationRules: {
        steps: { min: 0, max: 100000 },
        heart_rate: { min: 30, max: 220 },
        daily_score: { min: 0, max: 100 },
        ...config.validationRules
      }
    };
  }

  /**
   * Create a complete mock configuration for testing
   */
  static createMockConfig(config: Partial<MockFactoryConfig> = {}): MockFactoryConfig {
    const fullConfig: MockFactoryConfig = {
      healthProvider: {
        isAvailable: true,
        permissionStatus: 'granted',
        healthData: this.createTestHealthData('test-user-123'),
        ...config.healthProvider
      },
      supabase: {
        auth: {
          user: this.createTestUser(),
          session: this.createTestSession(this.createTestUser()),
          ...config.supabase?.auth
        },
        ...config.supabase
      },
      metricsService: {
        initialMetrics: this.createTestHealthData('test-user-123'),
        ...config.metricsService
      },
      healthMetrics: {
        ...config.healthMetrics
      }
    };

    const validation = this.validateConfig(fullConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid mock configuration: ${validation.errors.join(', ')}`);
    }

    return fullConfig;
  }
}
