import { GoogleHealthProvider } from '../GoogleHealthProvider';
import { Platform } from 'react-native';
import { initialize, requestPermission, readRecords } from 'react-native-health-connect';
import { NormalizedMetric } from '../../../types/metrics';
import { MetricType } from '@/src/types/metrics';

// Mock the platform to simulate Android
Platform.OS = 'android';
Platform.Version = 30; // Android 11

// Mock react-native-health-connect
jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  requestPermission: jest.fn().mockResolvedValue(true),
  readRecords: jest.fn().mockImplementation((recordType) => {
    if (recordType === 'Steps') {
      return Promise.resolve({
        records: [
          { 
            startTime: '2023-01-01T00:00:00.000Z', 
            endTime: '2023-01-01T23:59:59.999Z',
            count: 5000
          }
        ]
      });
    }
    if (recordType === 'Distance') {
      return Promise.resolve({
        records: [
          { 
            startTime: '2023-01-01T00:00:00.000Z', 
            endTime: '2023-01-01T23:59:59.999Z',
            distance: { inMeters: 3000 }
          }
        ]
      });
    }
    if (recordType === 'HeartRate') {
      return Promise.resolve({
        records: [
          { 
            startTime: '2023-01-01T00:00:00.000Z', 
            endTime: '2023-01-01T00:05:00.000Z',
            samples: [{ beatsPerMinute: 70 }]
          },
          {
            startTime: '2023-01-01T00:10:00.000Z', 
            endTime: '2023-01-01T00:15:00.000Z',
            samples: [{ beatsPerMinute: 75 }]
          }
        ]
      });
    }
    return Promise.resolve({ records: [] });
  })
}));

// Mock logger
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

describe('GoogleHealthProvider', () => {
  let provider: GoogleHealthProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GoogleHealthProvider();
  });

  describe('initialize', () => {
    it('should initialize correctly on Android', async () => {
      await provider.initialize();
      expect(initialize).toHaveBeenCalled();
      expect(provider['initialized']).toBe(true);
    });

    it('should throw error on non-Android platforms', async () => {
      // Temporarily change platform for this test
      const originalPlatform = Platform.OS;
      Platform.OS = 'ios';
      
      await expect(provider.initialize()).rejects.toThrow();
      
      // Restore platform
      Platform.OS = originalPlatform;
    });
  });

  describe('standardizedAggregateMetric', () => {
    it('should aggregate metrics according to type', async () => {
      await provider.initialize();
      
      const metrics: NormalizedMetric[] = [
        {
          timestamp: new Date().toISOString(),
          value: 100,
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
      
      // Access the protected method for testing
      const result = (provider as any).standardizedAggregateMetric(metrics);
      
      // Verify the standardized aggregation works
      expect(result).toBe(300);
    });
  });

  describe('fetchRawMetrics', () => {
    it('should fetch multiple metric types with permission granted', async () => {
      // Setup
      await provider.initialize();
      
      // Mock the permission check to always return granted
      jest.spyOn(provider as any, 'checkPermissionsStatus').mockResolvedValue({
        status: 'granted',
        lastChecked: Date.now()
      });
      
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-01T23:59:59.999Z');
      const metricTypes = ['steps', 'distance', 'heart_rate'] as MetricType[];
      
      // Reset the mocks to ensure they're called
      (readRecords as jest.Mock).mockClear();
      
      // Execute
      const result = await provider.fetchRawMetrics(startDate, endDate, metricTypes);
      
      // Verify
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('distance');
      expect(result).toHaveProperty('heart_rate');
      expect(readRecords).toHaveBeenCalledWith('Steps', expect.anything());
      expect(readRecords).toHaveBeenCalledWith('Distance', expect.anything());
      expect(readRecords).toHaveBeenCalledWith('HeartRate', expect.anything());
    });
  });

  describe('getMetrics', () => {
    // Add test for the updated getMetrics method that uses batchFetchHealthMetrics
    it('should use batchFetchHealthMetrics when implemented', async () => {
      // This test will need to be updated when batchFetchHealthMetrics is implemented
      // For now, we'll just check that the current method works
      
      // Setup - initialize the provider
      await provider.initialize();
      
      // Mock the permission check to always return granted
      jest.spyOn(provider as any, 'checkPermissionsStatus').mockResolvedValue({
        status: 'granted',
        lastChecked: Date.now()
      });
      
      // Mock the fetchRawMetrics method
      const fetchRawMetricsSpy = jest.spyOn(provider, 'fetchRawMetrics').mockResolvedValue({
        steps: [{ startDate: '2023-01-01', endDate: '2023-01-01', value: 5000, unit: 'count' }],
        distance: [{ startDate: '2023-01-01', endDate: '2023-01-01', value: 3000, unit: 'meters' }],
        heart_rate: [{ startDate: '2023-01-01', endDate: '2023-01-01', value: 72, unit: 'bpm' }]
      });
      
      // Execute
      const result = await provider.getMetrics();
      
      // Verify
      expect(fetchRawMetricsSpy).toHaveBeenCalled();
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('distance');
      expect(result).toHaveProperty('heart_rate');
    });
  });

  describe('requestPermissions', () => {
    it('should request Health Connect permissions', async () => {
      // Setup - initialize the provider
      await provider.initialize();
      
      // Mock a valid permission manager
      provider['permissionManager'] = {
        requestPermissions: jest.fn().mockResolvedValue('granted'),
        checkPermissionsStatus: jest.fn(),
        updatePermissionState: jest.fn()
      };
      
      // Reset the mock to ensure it's called
      (requestPermission as jest.Mock).mockClear();
      
      // Execute
      const result = await provider.requestPermissions();
      
      // Verify
      expect(requestPermission).toHaveBeenCalled();
      expect(result).toBe('granted');
    });
  });
}); 