import {
  initializeHealthProviderForUser,
  mapAuthError,
  mapHealthProviderError,
  normalizeMetric,
  aggregateMetrics
} from '../healthProviderUtils';
import { HealthProviderFactory } from '../../providers/health/factory/HealthProviderFactory';
import { NormalizedMetric } from '../../providers/health/types/metrics';

// Mock the HealthProviderFactory
jest.mock('../../providers/health/factory/HealthProviderFactory', () => ({
  HealthProviderFactory: {
    getProvider: jest.fn()
  }
}));

describe('healthProviderUtils', () => {
  describe('initializeHealthProviderForUser', () => {
    const mockSetHealthStatus = jest.fn();
    const mockProvider = {
      initializePermissions: jest.fn(),
      checkPermissionsStatus: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
      (HealthProviderFactory.getProvider as jest.Mock).mockReturnValue(mockProvider);
    });

    it('should initialize provider and set status', async () => {
      mockProvider.checkPermissionsStatus.mockResolvedValue({ status: 'granted' });

      await initializeHealthProviderForUser('test-user', mockSetHealthStatus);

      expect(mockProvider.initializePermissions).toHaveBeenCalledWith('test-user');
      expect(mockSetHealthStatus).toHaveBeenCalledWith('granted');
    });

    it('should handle initialization errors', async () => {
      mockProvider.initializePermissions.mockRejectedValue(new Error('Init failed'));

      await initializeHealthProviderForUser('test-user', mockSetHealthStatus);

      expect(mockSetHealthStatus).toHaveBeenCalledWith('not_determined');
    });
  });

  describe('mapAuthError', () => {
    it('should map permission errors', () => {
      const error = new Error('Error code: 42501');
      expect(mapAuthError(error)).toBe('Access permission issue. Please contact support.');
    });

    it('should map HealthKit errors', () => {
      const error = new Error('HealthKit access denied');
      expect(mapAuthError(error)).toBe('Health services initialization/access issue. Please check your settings.');
    });

    it('should map HealthConnect errors', () => {
      const error = new Error('HealthConnect not available');
      expect(mapAuthError(error)).toBe('Health services initialization/access issue. Please check your settings.');
    });

    it('should return original message for other errors', () => {
      const error = new Error('Generic error');
      expect(mapAuthError(error)).toBe('Generic error');
    });

    it('should handle non-Error objects', () => {
      expect(mapAuthError('string error')).toBe('An unexpected error occurred.');
    });
  });

  describe('mapHealthProviderError', () => {
    it('should map Apple Health errors', () => {
      const error = new Error('HealthKit not authorized');
      expect(mapHealthProviderError(error, 'apple'))
        .toBe('Unable to access Apple Health. Please check your device settings.');
    });

    it('should map Google Health errors', () => {
      const error = new Error('HealthConnect not available');
      expect(mapHealthProviderError(error, 'google'))
        .toBe('Unable to access Google Health Connect. Please check your device settings.');
    });

    it('should handle non-Error objects', () => {
      expect(mapHealthProviderError('error', 'apple'))
        .toBe('Unable to access health data on apple.');
    });
  });

  describe('normalizeMetric', () => {
    it('should transform raw data to normalized metrics', () => {
      const rawData = [
        { value: 100, timestamp: '2025-01-31T12:00:00Z' },
        { value: 200, timestamp: '2025-01-31T13:00:00Z' }
      ];

      const transform = (raw: typeof rawData[0]): NormalizedMetric => ({
        value: raw.value,
        timestamp: raw.timestamp,
        type: 'steps',
        unit: 'count'
      });

      const result = normalizeMetric(rawData, transform);

      expect(result).toEqual([
        { value: 100, timestamp: '2025-01-31T12:00:00Z', type: 'steps', unit: 'count' },
        { value: 200, timestamp: '2025-01-31T13:00:00Z', type: 'steps', unit: 'count' }
      ]);
    });

    it('should handle empty data', () => {
      const result = normalizeMetric([], () => ({
        value: 0,
        timestamp: '',
        type: 'steps',
        unit: 'count'
      }));

      expect(result).toEqual([]);
    });
  });

  describe('aggregateMetrics', () => {
    it('should average heart rate metrics', () => {
      const metrics: NormalizedMetric[] = [
        { value: 60, timestamp: '', type: 'heart_rate', unit: 'bpm' },
        { value: 80, timestamp: '', type: 'heart_rate', unit: 'bpm' }
      ];

      expect(aggregateMetrics(metrics)).toBe(70);
    });

    it('should sum other metrics', () => {
      const metrics: NormalizedMetric[] = [
        { value: 1000, timestamp: '', type: 'steps', unit: 'count' },
        { value: 2000, timestamp: '', type: 'steps', unit: 'count' }
      ];

      expect(aggregateMetrics(metrics)).toBe(3000);
    });

    it('should handle empty metrics', () => {
      expect(aggregateMetrics([])).toBeNull();
    });

    it('should handle invalid values', () => {
      const metrics: NormalizedMetric[] = [
        { value: 'invalid' as any, timestamp: '', type: 'steps', unit: 'count' },
        { value: 1000, timestamp: '', type: 'steps', unit: 'count' }
      ];

      expect(aggregateMetrics(metrics)).toBe(1000);
    });
  });
});
