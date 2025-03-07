import { BaseHealthProvider } from '../provider';
import { LogCategory } from '@/src/utils/logger';
import { HealthProviderPermissionError } from '../errors';
import { NormalizedMetric } from '../metrics';
import { PermissionState, PermissionStatus } from '../permissions';

// Create a concrete implementation of BaseHealthProvider for testing
class TestHealthProvider extends BaseHealthProvider {
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async fetchRawMetrics(): Promise<any> {
    return {};
  }

  async getMetrics(): Promise<any> {
    return {};
  }

  async requestPermissions(): Promise<PermissionStatus> {
    return 'granted';
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    return { status: 'granted', lastChecked: Date.now() };
  }
}

// Mock the logger
jest.mock('@/src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  LogCategory: {
    Health: 'Health'
  }
}));

describe('BaseHealthProvider', () => {
  let provider: TestHealthProvider;

  beforeEach(() => {
    provider = new TestHealthProvider();
    jest.clearAllMocks();
  });

  describe('standardizedAggregateMetric', () => {
    it('should return 0 for empty metrics array', () => {
      // @ts-ignore - Accessing protected method for testing
      const result = provider.standardizedAggregateMetric([]);
      expect(result).toBe(0);
    });

    it('should handle heart rate metrics with weighted average', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const twoMinutesAgo = new Date(now.getTime() - 120000);
      
      const heartRateMetrics: NormalizedMetric[] = [
        {
          timestamp: now.toISOString(),
          value: 75,
          type: 'heart_rate',
          unit: 'bpm'
        },
        {
          timestamp: oneMinuteAgo.toISOString(),
          value: 80,
          type: 'heart_rate',
          unit: 'bpm'
        },
        {
          timestamp: twoMinutesAgo.toISOString(),
          value: 70,
          type: 'heart_rate',
          unit: 'bpm'
        }
      ];

      // @ts-ignore - Accessing protected method for testing
      const result = provider.standardizedAggregateMetric(heartRateMetrics);
      
      // Recent readings (75, 80) weighted at 60%, older reading (70) at 40%
      // Average of recent (75+80)/2 = 77.5
      // Weighted: 77.5 * 0.6 + 70 * 0.4 = 46.5 + 28 = 74.5 = 75 rounded
      expect(result).toBe(75);
    });

    it('should sum values for non-heart-rate metrics', () => {
      const stepsMetrics: NormalizedMetric[] = [
        {
          timestamp: new Date().toISOString(),
          value: 1000,
          type: 'steps',
          unit: 'count'
        },
        {
          timestamp: new Date().toISOString(),
          value: 2000,
          type: 'steps',
          unit: 'count'
        }
      ];

      // @ts-ignore - Accessing protected method for testing
      const result = provider.standardizedAggregateMetric(stepsMetrics);
      expect(result).toBe(3000);
    });

    it('should filter out invalid values', () => {
      const metrics: NormalizedMetric[] = [
        {
          timestamp: new Date().toISOString(),
          value: 100,
          type: 'steps',
          unit: 'count'
        },
        {
          timestamp: new Date().toISOString(),
          value: NaN,
          type: 'steps',
          unit: 'count'
        },
        {
          timestamp: new Date().toISOString(),
          value: 200,
          type: 'steps',
          unit: 'count'
        }
      ];

      // @ts-ignore - Accessing protected method for testing
      const result = provider.standardizedAggregateMetric(metrics);
      expect(result).toBe(300);
    });
  });

  describe('handleProviderError', () => {
    it('should format and log errors', () => {
      const errorMessage = 'Test error';
      const error = new Error(errorMessage);
      
      try {
        // @ts-ignore - Accessing protected method for testing
        provider.handleProviderError('testing', error);
        fail('Expected error to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toContain('TestHealthProvider');
        expect((e as Error).message).toContain(errorMessage);
      }
    });

    it('should convert string errors to Error objects', () => {
      try {
        // @ts-ignore - Accessing protected method for testing
        provider.handleProviderError('testing', 'String error');
        fail('Expected error to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toContain('String error');
      }
    });

    it('should convert permission-related errors to HealthProviderPermissionError', () => {
      try {
        // @ts-ignore - Accessing protected method for testing
        provider.handleProviderError('permission check', new Error('Permission denied'));
        fail('Expected error to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HealthProviderPermissionError);
      }
    });

    it('should add metric type to error message when provided', () => {
      try {
        // @ts-ignore - Accessing protected method for testing
        provider.handleProviderError('fetching', new Error('Failed'), 'steps');
        fail('Expected error to be thrown');
      } catch (e) {
        expect((e as Error).message).toContain('steps');
      }
    });
  });
});