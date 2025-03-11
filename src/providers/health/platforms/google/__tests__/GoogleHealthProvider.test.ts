import { GoogleHealthProvider } from '../GoogleHealthProvider';
import { Platform } from 'react-native';
import { initialize, requestPermission, readRecords } from 'react-native-health-connect';
import { NormalizedMetric } from '../../../types/metrics';
import { MetricType } from '@/src/types/metrics';
import { HealthProviderPermissionError } from '../../../types/errors';

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
    if (recordType === 'ActiveCaloriesBurned') {
      return Promise.resolve({
        records: [
          {
            startTime: '2023-01-01T00:00:00.000Z',
            endTime: '2023-01-01T23:59:59.999Z',
            energy: { inKilocalories: 400 }
          }
        ]
      });
    }
    if (recordType === 'BasalMetabolicRate') {
      return Promise.resolve({
        records: [
          {
            startTime: '2023-01-01T00:00:00.000Z',
            endTime: '2023-01-01T23:59:59.999Z',
            energy: { inKilocalories: 1500 },
            metadata: { id: 'test-id' }
          }
        ]
      });
    }
    if (recordType === 'FloorsClimbed') {
      return Promise.resolve({
        records: [
          {
            startTime: '2023-01-01T00:00:00.000Z',
            endTime: '2023-01-01T23:59:59.999Z',
            floors: 12
          }
        ]
      });
    }
    if (recordType === 'ExerciseSession') {
      return Promise.resolve({
        records: [
          {
            metadata: { id: 'exercise-1' },
            startTime: '2023-01-01T08:00:00.000Z',
            endTime: '2023-01-01T08:30:00.000Z',
            exerciseType: 'running'
          },
          {
            metadata: { id: 'exercise-2' },
            startTime: '2023-01-01T16:00:00.000Z',
            endTime: '2023-01-01T16:45:00.000Z',
            exerciseType: 'walking'
          }
        ]
      });
    }
    return Promise.resolve({ records: [] });
  })
}));

// Mock verifyHealthPermission
jest.mock('../../../../utils/healthPermissionUtils', () => ({
  verifyHealthPermission: jest.fn().mockResolvedValue(true)
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

// Mock DateUtils
jest.mock('../../../../utils/DateUtils', () => ({
  DateUtils: {
    getStartOfDay: jest.fn(date => {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      return startOfDay;
    }),
    getEndOfDay: jest.fn(date => {
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      return endOfDay;
    })
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

    it('should check Android version and throw error if too old', async () => {
      // Temporarily change Android version
      const originalVersion = Platform.Version;
      Platform.Version = 7; // Android 7 is below required version 8
      
      await expect(provider.initialize()).rejects.toThrow('Health Connect requires Android 8 or newer');
      
      // Restore version
      Platform.Version = originalVersion;
    });

    it('should handle initialization failures gracefully', async () => {
      // Mock initialize to fail
      (initialize as jest.Mock).mockRejectedValueOnce(new Error('Initialization failed'));
      
      await expect(provider.initialize()).rejects.toThrow();
      expect(provider['initialized']).toBe(false);
    });

    it('should handle unavailable Health Connect', async () => {
      // Mock initialize to return false (unavailable)
      (initialize as jest.Mock).mockResolvedValueOnce(false);
      
      await expect(provider.initialize()).rejects.toThrow('Health Connect is not available');
      expect(provider['initialized']).toBe(false);
    });

    it('should reuse existing initialization if already in progress', async () => {
      // Create a promise that we can control
      let resolveInit: Function;
      const initPromise = new Promise<void>(resolve => {
        resolveInit = resolve;
      });
      
      // Set the initialization promise but don't resolve yet
      provider['initializationPromise'] = initPromise;
      provider['initialized'] = false;
      
      // Start a new initialization without awaiting
      const initPromise1 = provider.initialize();
      const initPromise2 = provider.initialize();
      
      // Resolve the original promise
      resolveInit!();
      
      // Both should complete
      await Promise.all([initPromise1, initPromise2]);
      
      // Initialize should only be called once
      expect(initialize).not.toHaveBeenCalled();
    });
  });

  describe('initializeWithPermissions', () => {
    it('should initialize provider and permissions', async () => {
      const initSpy = jest.spyOn(provider, 'initialize').mockResolvedValue();
      const initPermSpy = jest.spyOn(provider, 'initializePermissions').mockResolvedValue();
      
      await provider.initializeWithPermissions('test-user-id');
      
      expect(initSpy).toHaveBeenCalled();
      expect(initPermSpy).toHaveBeenCalledWith('test-user-id');
    });

    it('should handle initialization errors', async () => {
      jest.spyOn(provider, 'initialize').mockRejectedValue(new Error('Init failed'));
      
      await expect(provider.initializeWithPermissions('test-user-id')).rejects.toThrow('Init failed');
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

    it('should handle heart rate metrics with weighted average', async () => {
      await provider.initialize();
      
      const metrics: NormalizedMetric[] = [
        {
          timestamp: new Date().toISOString(),
          value: 70,
          type: 'heart_rate',
          unit: 'bpm'
        },
        {
          timestamp: new Date().toISOString(),
          value: 80,
          type: 'heart_rate',
          unit: 'bpm'
        },
        {
          timestamp: new Date().toISOString(),
          value: 90,
          type: 'heart_rate',
          unit: 'bpm'
        },
        {
          timestamp: new Date().toISOString(),
          value: 100,
          type: 'heart_rate',
          unit: 'bpm'
        }
      ];
      
      // Access the protected method for testing
      const result = (provider as any).standardizedAggregateMetric(metrics);
      
      // Should return a weighted average (not just simple average)
      expect(result).not.toBe(85);
    });

    it('should handle empty metrics array', async () => {
      await provider.initialize();
      
      // Access the protected method for testing
      const result = (provider as any).standardizedAggregateMetric([]);
      
      // Should return 0 for empty array
      expect(result).toBe(0);
    });
  });

  describe('checkPermissionsStatus', () => {
    it('should return not_determined when permission manager is not initialized', async () => {
      // Ensure permissionManager is null
      provider['permissionManager'] = null;
      
      const result = await provider.checkPermissionsStatus();
      
      expect(result.status).toBe('not_determined');
    });

    it('should use cached permission state when available', async () => {
      // Mock permission manager with cached state
      provider['permissionManager'] = {
        getPermissionState: jest.fn().mockResolvedValue({
          status: 'granted',
          lastChecked: Date.now()
        }),
        updatePermissionState: jest.fn(),
        handlePermissionError: jest.fn()
      } as any;
      
      const result = await provider.checkPermissionsStatus();
      
      expect(result.status).toBe('granted');
      expect(provider['permissionManager']?.getPermissionState).toHaveBeenCalled();
      expect(provider['permissionManager']?.updatePermissionState).not.toHaveBeenCalled();
    });

    it('should check initialization status when cache is empty', async () => {
      // Mock permission manager with no cached state
      provider['permissionManager'] = {
        getPermissionState: jest.fn().mockResolvedValue(null),
        updatePermissionState: jest.fn(),
        handlePermissionError: jest.fn()
      } as any;
      
      // Mock the initialize call
      (initialize as jest.Mock).mockClear();
      
      const result = await provider.checkPermissionsStatus();
      
      expect(initialize).toHaveBeenCalled();
      expect(provider['permissionManager']?.updatePermissionState).toHaveBeenCalled();
    });

    it('should handle initialization errors during check', async () => {
      // Mock permission manager with no cached state
      provider['permissionManager'] = {
        getPermissionState: jest.fn().mockResolvedValue(null),
        updatePermissionState: jest.fn(),
        handlePermissionError: jest.fn()
      } as any;
      
      // Mock initialize to throw
      (initialize as jest.Mock).mockRejectedValueOnce(new Error('Check failed'));
      
      const result = await provider.checkPermissionsStatus();
      
      expect(result.status).toBe('denied');
      expect(provider['permissionManager']?.updatePermissionState).toHaveBeenCalledWith('denied', expect.anything());
    });
  });

  describe('requestPermissions', () => {
    it('should request Health Connect permissions', async () => {
      // Setup - initialize the provider
      await provider.initialize();
      
      // Mock a valid permission manager
      provider['permissionManager'] = {
        getPermissionState: jest.fn(),
        updatePermissionState: jest.fn(),
        handlePermissionError: jest.fn()
      } as any;
      
      // Mock checkPermissionsStatus to return not_determined
      jest.spyOn(provider, 'checkPermissionsStatus').mockResolvedValue({
        status: 'not_determined',
        lastChecked: Date.now()
      });
      
      // Mock verifyPermissions to return true
      jest.spyOn(provider as any, 'verifyPermissions').mockResolvedValue(true);
      
      // Reset the mocks to ensure they're called
      (requestPermission as jest.Mock).mockClear();
      
      // Execute
      const result = await provider.requestPermissions();
      
      // Verify
      expect(requestPermission).toHaveBeenCalled();
      expect(provider['permissionManager']?.updatePermissionState).toHaveBeenCalledWith('granted');
      expect(result).toBe('granted');
    });

    it('should return granted if permissions already granted', async () => {
      // Setup - initialize the provider
      await provider.initialize();
      
      // Mock a valid permission manager
      provider['permissionManager'] = {
        getPermissionState: jest.fn(),
        updatePermissionState: jest.fn(),
        handlePermissionError: jest.fn()
      } as any;
      
      // Mock checkPermissionsStatus to return already granted
      jest.spyOn(provider, 'checkPermissionsStatus').mockResolvedValue({
        status: 'granted',
        lastChecked: Date.now()
      });
      
      // Execute
      const result = await provider.requestPermissions();
      
      // Verify
      expect(requestPermission).not.toHaveBeenCalled();
      expect(result).toBe('granted');
    });

    it('should return not_determined if permissionManager is null', async () => {
      // Setup - initialize the provider
      await provider.initialize();
      
      // Ensure permissionManager is null
      provider['permissionManager'] = null;
      
      // Execute
      const result = await provider.requestPermissions();
      
      // Verify
      expect(result).toBe('not_determined');
    });

    it('should handle permission request errors', async () => {
      // Setup - initialize the provider
      await provider.initialize();
      
      // Mock a valid permission manager
      provider['permissionManager'] = {
        getPermissionState: jest.fn(),
        updatePermissionState: jest.fn(),
        handlePermissionError: jest.fn()
      } as any;
      
      // Mock checkPermissionsStatus
      jest.spyOn(provider, 'checkPermissionsStatus').mockResolvedValue({
        status: 'not_determined',
        lastChecked: Date.now()
      });
      
      // Mock requestPermission to throw
      (requestPermission as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));
      
      // Execute
      const result = await provider.requestPermissions();
      
      // Verify
      expect(provider['permissionManager']?.handlePermissionError).toHaveBeenCalled();
      expect(result).toBe('denied');
    });

    it('should handle verification failures', async () => {
      // Setup
      await provider.initialize();
      
      // Mock permissionManager
      provider['permissionManager'] = {
        getPermissionState: jest.fn(),
        updatePermissionState: jest.fn(),
        handlePermissionError: jest.fn()
      } as any;
      
      // Mock checkPermissionsStatus
      jest.spyOn(provider, 'checkPermissionsStatus').mockResolvedValue({
        status: 'not_determined',
        lastChecked: Date.now()
      });
      
      // Mock verifyPermissions to return false (not enough permissions)
      jest.spyOn(provider as any, 'verifyPermissions').mockResolvedValue(false);
      
      // Execute
      const result = await provider.requestPermissions();
      
      // Verify
      expect(provider['permissionManager']?.updatePermissionState).toHaveBeenCalledWith('denied');
      expect(result).toBe('denied');
    });
  });

  describe('verifyPermissions', () => {
    it('should verify permissions by checking multiple metric types', async () => {
      // Setup
      await provider.initialize();
      
      // Reset readRecords mock
      (readRecords as jest.Mock).mockClear();
      
      // Call the private method
      const result = await (provider as any).verifyPermissions();
      
      // Verify
      expect(readRecords).toHaveBeenCalledTimes(expect.any(Number));
      expect(result).toBe(true);
    });

    it('should handle partial permissions correctly', async () => {
      // Setup
      await provider.initialize();
      
      // Mock readRecords to succeed for only 2 permissions
      (readRecords as jest.Mock).mockImplementation((recordType) => {
        if (recordType === 'Steps' || recordType === 'Distance') {
          return Promise.resolve({ records: [{ count: 1000 }] });
        }
        return Promise.reject(new Error('Permission not granted'));
      });
      
      // Call the private method
      const result = await (provider as any).verifyPermissions();
      
      // Should still be true with 2 permissions (minimum is 3)
      expect(result).toBe(false);
    });

    it('should handle errors during verification', async () => {
      // Setup
      await provider.initialize();
      
      // Mock readRecords to completely fail
      (readRecords as jest.Mock).mockRejectedValue(new Error('Verification failed'));
      
      // Call the private method
      const result = await (provider as any).verifyPermissions();
      
      // Should return false on error
      expect(result).toBe(false);
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

    it('should throw HealthProviderPermissionError when permissions not granted', async () => {
      // Setup
      await provider.initialize();
      
      // Mock permission check to return denied
      jest.spyOn(provider, 'checkPermissionsStatus').mockResolvedValue({
        status: 'denied',
        lastChecked: Date.now()
      });
      
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-01T23:59:59.999Z');
      const metricTypes = ['steps'] as MetricType[];
      
      // Execute & Verify
      await expect(provider.fetchRawMetrics(startDate, endDate, metricTypes))
        .rejects.toThrow(HealthProviderPermissionError);
    });

    it('should handle errors in individual metric fetches', async () => {
      // Setup
      await provider.initialize();
      
      // Mock permission check to return granted
      jest.spyOn(provider, 'checkPermissionsStatus').mockResolvedValue({
        status: 'granted',
        lastChecked: Date.now()
      });
      
      // Mock one specific fetch to fail
      jest.spyOn(provider as any, 'fetchStepsWithDailyAggregation').mockRejectedValue(
        new Error('Failed to fetch steps')
      );
      
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-01T23:59:59.999Z');
      const metricTypes = ['steps', 'distance'] as MetricType[];
      
      // Execute
      const result = await provider.fetchRawMetrics(startDate, endDate, metricTypes);
      
      // Verify - should still have distance but steps should be empty array
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('distance');
      expect(result.steps).toEqual([]);
      expect(result.distance).not.toEqual([]);
    });
  });

  describe('daily aggregation methods', () => {
    beforeEach(() => {
      // Initialize for all tests
      provider.initialize();
    });
    
    it('should aggregate steps data by day', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-01T23:59:59.999Z');
      
      // Execute
      const result = await (provider as any).fetchStepsWithDailyAggregation(startDate, endDate);
      
      // Verify
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(5000);
      expect(result[0].unit).toBe('count');
    });
    
    it('should aggregate distance data by day', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-01T23:59:59.999Z');
      
      // Execute
      const result = await (provider as any).fetchDistanceWithDailyAggregation(startDate, endDate);
      
      // Verify
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(3000);
      expect(result[0].unit).toBe('meters');
    });
    
    it('should aggregate calories data by day', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-01T23:59:59.999Z');
      
      // Execute
      const result = await (provider as any).fetchCaloriesWithDailyAggregation(startDate, endDate);
      
      // Verify
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(400);
      expect(result[0].unit).toBe('kcal');
    });
    
    it('should handle heart rate data correctly', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-01T23:59:59.999Z');
      
      // Execute
      const result = await (provider as any).fetchHeartRateWithDailyAggregation(startDate, endDate);
      
      // Verify
      expect(result).toHaveLength(1);
      // Average of 70 and 75
      expect(result[0].value).toBe(73);
      expect(result[0].unit).toBe('bpm');
    });
    
    it('should handle basal calories with permission check', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-01T23:59:59.999Z');
      
      const verifyHealthPermissionMock = require('../../../../utils/healthPermissionUtils').verifyHealthPermission;
      
      // Mock the permission check to return true
      verifyHealthPermissionMock.mockResolvedValue(true);
      
      // Execute
      const result = await (provider as any).fetchBasalCaloriesWithDailyAggregation(startDate, endDate);
      
      // Verify
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(1500);
      expect(result[0].unit).toBe('kcal');
      expect(verifyHealthPermissionMock).toHaveBeenCalled();
    });
    
    it('should handle basal calories when permission denied', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-01T23:59:59.999Z');
      
      const verifyHealthPermissionMock = require('../../../../utils/healthPermissionUtils').verifyHealthPermission;
      
      // Mock the permission check to return false
      verifyHealthPermissionMock.mockResolvedValue(false);
      
      // Execute
      const result = await (provider as any).fetchBasalCaloriesWithDailyAggregation(startDate, endDate);
      
      // Verify - should return empty with no permission
      expect(result).toEqual([]);
    });
    
    it('should handle floors climbed data by day', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-01T23:59:59.999Z');
      
      // Execute
      const result = await (provider as any).fetchFloorsClimbedWithDailyAggregation(startDate, endDate);
      
      // Verify
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(12);
      expect(result[0].unit).toBe('count');
    });
    
    it('should handle exercise time appropriately', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-01T23:59:59.999Z');
      
      // Mock exercise session data
      const mockExerciseSessions = [
        {
          metadata: { id: 'exercise-1' },
          startTime: '2023-01-01T08:00:00.000Z',
          endTime: '2023-01-01T08:30:00.000Z',
          exerciseType: 'running'
        },
        {
          metadata: { id: 'exercise-2' },
          startTime: '2023-01-01T16:00:00.000Z',
          endTime: '2023-01-01T16:45:00.000Z',
          exerciseType: 'walking'
        }
      ];
      
      // Mock readRecords to return exercise sessions
      (readRecords as jest.Mock).mockImplementation((recordType, options) => {
        if (recordType === 'ExerciseSession') {
          return Promise.resolve(mockExerciseSessions);
        }
        return Promise.resolve([]);
      });
      
      // Execute
      const result = await (provider as any).fetchExerciseWithDailyAggregation(startDate, endDate);
      
      // Verify
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1); // One day of data
      expect(result[0].value).toBe(75); // 30 + 45 minutes
      expect(result[0].unit).toBe('minutes');
      expect(result[0].startDate).toBe('2023-01-01T00:00:00.000Z');
      expect(result[0].endDate).toBe('2023-01-01T23:59:59.999Z');
    });
  });

  describe('normalizeMetrics', () => {
    it('should normalize step metrics correctly', async () => {
      // Setup
      await provider.initialize();
      
      const rawData = {
        steps: [
          { 
            startDate: '2023-01-01T00:00:00.000Z', 
            endDate: '2023-01-01T23:59:59.999Z',
            value: 5000,
            unit: 'count'
          }
        ]
      };
      
      // Mock the BaseHealthProvider's normalizeMetrics to check if it's called
      jest.spyOn(Object.getPrototypeOf(provider), 'normalizeMetrics');
      
      // Execute
      const result = provider.normalizeMetrics(rawData, 'steps');
      
      // Verify that parent method was called
      expect(Object.getPrototypeOf(provider).normalizeMetrics).toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    // Test for the getMetrics method that uses batchFetchHealthMetrics
    it('should use batchFetchHealthMetrics when implemented', async () => {
      // Setup - initialize the provider
      await provider.initialize();
      
      // Mock the permission check to always return granted
      jest.spyOn(provider as any, 'checkPermissionsStatus').mockResolvedValue({
        status: 'granted',
        lastChecked: Date.now()
      });
      
      // Create a proper mock for batchFetchHealthMetrics
      const mockMetrics = {
        id: '',
        user_id: '',
        date: new Date().toISOString().split('T')[0],
        steps: 5000,
        distance: 3000,
        calories: 400,
        heart_rate: 73,
        exercise: 30,
        basal_calories: 1500,
        flights_climbed: 12,
        daily_score: 0,
        weekly_score: null,
        streak_days: null,
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Mock batchFetchHealthMetrics
      jest.spyOn(provider as any, 'batchFetchHealthMetrics').mockResolvedValue(mockMetrics);
      
      // Execute
      const result = await provider.getMetrics();
      
      // Verify
      expect(provider['batchFetchHealthMetrics']).toHaveBeenCalled();
      expect(result).toBe(mockMetrics);
    });

    it('should handle errors in batchFetchHealthMetrics', async () => {
      // Setup - initialize the provider
      await provider.initialize();
      
      // Mock error in batchFetchHealthMetrics
      jest.spyOn(provider as any, 'batchFetchHealthMetrics').mockRejectedValue(
        new Error('Failed to fetch metrics')
      );
      
      // Mock handleProviderError to prevent test failures
      jest.spyOn(provider as any, 'handleProviderError').mockImplementation(() => {
        throw new Error('Handled error');
      });
      
      // Execute & Verify
      await expect(provider.getMetrics()).rejects.toThrow('Handled error');
      expect(provider['batchFetchHealthMetrics']).toHaveBeenCalled();
      expect(provider['handleProviderError']).toHaveBeenCalled();
    });
  });
});