import { AppleHealthProvider } from '../AppleHealthProvider';
import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import { NormalizedMetric } from '../../../types/metrics';
import { PermissionState } from '../../../types/permissions';

// Mock the platform to simulate iOS
Platform.OS = 'ios';
// Add iOS version mocking
Platform.Version = '16.1';

// Mock AppleHealthKit
jest.mock('react-native-health', () => ({
  initHealthKit: jest.fn((permissions, callback) => callback(null)),
  isAvailable: jest.fn((callback) => callback(null, true)),
  getStepCount: jest.fn((options, callback) => callback(null, { value: 1000 })),
  getDailyStepCountSamples: jest.fn((options, callback) => 
    callback(null, [
      { value: 500, startDate: '2023-01-01T00:00:00.000Z', endDate: '2023-01-01T12:00:00.000Z' },
      { value: 500, startDate: '2023-01-01T12:00:00.000Z', endDate: '2023-01-01T23:59:59.999Z' }
    ])
  ),
  getDistanceWalkingRunning: jest.fn((options, callback) => callback(null, { value: 1500 })),
  getDailyDistanceWalkingRunningSamples: jest.fn((options, callback) => 
    callback(null, [
      { value: 750, startDate: '2023-01-01T00:00:00.000Z', endDate: '2023-01-01T12:00:00.000Z' },
      { value: 750, startDate: '2023-01-01T12:00:00.000Z', endDate: '2023-01-01T23:59:59.999Z' }
    ])
  ),
  getActiveEnergyBurned: jest.fn((options, callback) => 
    callback(null, [
      { value: 300, startDate: '2023-01-01T00:00:00.000Z', endDate: '2023-01-01T23:59:59.999Z' }
    ])
  ),
  getHeartRateSamples: jest.fn((options, callback) => 
    callback(null, [
      { value: 70, startDate: '2023-01-01T00:00:00.000Z', endDate: '2023-01-01T00:05:00.000Z' },
      { value: 75, startDate: '2023-01-01T00:10:00.000Z', endDate: '2023-01-01T00:15:00.000Z' }
    ])
  ),
  getFlightsClimbed: jest.fn((options, callback) => callback(null, { value: 10 })),
  getBasalEnergyBurned: jest.fn((options, callback) => callback(null, { value: 1800 })),
  getAppleExerciseTime: jest.fn((options, callback) => callback(null, { value: 30 })),
}));

// Mock the promisify utility
jest.mock('@/src/utils/promiseWrapper', () => ({
  promisify: jest.fn((fn, ...args) => {
    // Simple implementation that calls the function with args and mocks a Promise
    return new Promise((resolve, reject) => {
      fn(...args, (error: any, result: any) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  })
}));

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

// Mock the DateUtils
jest.mock('@/src/utils/DateUtils', () => ({
  DateUtils: {
    getStartOfDay: jest.fn(() => new Date('2023-01-01T00:00:00.000Z')),
    getLocalDateString: jest.fn(() => '2023-01-01')
  }
}));

describe('AppleHealthProvider', () => {
  let provider: AppleHealthProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new AppleHealthProvider();
    // Mock the batchFetchHealthMetrics method for isolation
    jest.spyOn(provider as any, 'batchFetchHealthMetrics').mockResolvedValue({
      steps: 2000,
      distance: 1500,
      calories: 300,
      heart_rate: 75
    });
  });

  describe('initialize', () => {
    it('should initialize correctly on iOS', async () => {
      await provider.initialize();
      expect(AppleHealthKit.initHealthKit).toHaveBeenCalled();
      expect(provider['initialized']).toBe(true);
    });

    it('should throw error on non-iOS platforms', async () => {
      // Temporarily change platform for this test
      const originalPlatform = Platform.OS;
      Platform.OS = 'android';
      
      await expect(provider.initialize()).rejects.toThrow();
      
      // Restore platform
      Platform.OS = originalPlatform;
    });

    it('should check iOS version during initialization', async () => {
      // Test with old iOS version
      const originalVersion = Platform.Version;
      Platform.Version = '7.0';
      
      await expect(provider.initialize()).rejects.toThrow('HealthKit requires iOS 8 or newer');
      
      // Restore version
      Platform.Version = originalVersion;
    });

    it('should retry initialization on failure', async () => {
      // Set explicit timeout
      jest.setTimeout(60000);
      
      // Mock initHealthKit to fail once then succeed
      let callCount = 0;
      jest.spyOn(AppleHealthKit, 'initHealthKit').mockImplementation((permissions, callback) => {
        callCount++;
        if (callCount === 1) {
          callback('Error on first try', null);
        } else {
          callback(null, null);
        }
      });

      // Force timers to advance immediately after each retry
      jest.useFakeTimers({ advanceTimers: true });
      
      await provider.initialize();
      
      expect(AppleHealthKit.initHealthKit).toHaveBeenCalledTimes(2);
      expect(provider['initialized']).toBe(true);
      
      jest.useRealTimers();
    }, 60000); // Explicit test timeout
  });

  describe('permission handling', () => {
    beforeEach(() => {
      // Mock the permission manager
      const mockPermissionManager = {
        getPermissionState: jest.fn().mockResolvedValue({ status: 'granted', lastChecked: Date.now() }),
        updatePermissionState: jest.fn().mockResolvedValue(undefined),
        handlePermissionError: jest.fn().mockResolvedValue(undefined),
        clearCache: jest.fn().mockResolvedValue(undefined)
      };
      provider['permissionManager'] = mockPermissionManager as any;
    });

    it('should check permissions status correctly', async () => {
      const permissionState = await provider.checkPermissionsStatus();
      expect(permissionState.status).toBe('granted');
      expect(provider['permissionManager']?.getPermissionState).toHaveBeenCalled();
    });

    it('should handle uninitialized permission manager gracefully', async () => {
      provider['permissionManager'] = null;
      const ensurePermSpy = jest.spyOn(provider as any, 'ensurePermissionsInitialized');
      ensurePermSpy.mockResolvedValue(undefined);
      
      const permissionState = await provider.checkPermissionsStatus();
      expect(permissionState.status).toBe('not_determined');
      expect(ensurePermSpy).toHaveBeenCalled();
    });

    it('should request permissions successfully', async () => {
      jest.spyOn(provider, 'initialize').mockResolvedValue();
      jest.spyOn(provider, 'checkPermissionsStatus').mockResolvedValue({
        status: 'not_determined',
        lastChecked: Date.now()
      });
      
      const status = await provider.requestPermissions();
      expect(status).toBe('granted');
      expect(provider['permissionManager']?.updatePermissionState).toHaveBeenCalledWith('granted');
    });

    it('should handle permission denial', async () => {
      await provider.initialize();

      // Mock initHealthKit to properly simulate permission denial
      const initHealthKitMock = jest.spyOn(AppleHealthKit, 'initHealthKit')
        .mockImplementation((_, callback) => callback('Permission denied', undefined));

      // Mock permission manager
      const updatePermissionStateSpy = jest.spyOn(
        provider['permissionManager'] as any, 
        'updatePermissionState'
      );

      const status = await provider.requestPermissions();

      expect(status).toBe('denied');
      expect(updatePermissionStateSpy).toHaveBeenCalledWith('denied');
      
      initHealthKitMock.mockRestore();
    });
  });

  describe('standardizedAggregateMetric', () => {
    it('should aggregate metrics according to their type', async () => {
      jest.setTimeout(60000);
      
      // Skip actual initialization
      provider['initialized'] = true;
      
      const metrics: NormalizedMetric[] = [
        {
          timestamp: new Date().toISOString(),
          value: 100,
          type: 'steps',
          unit: 'count'
        }
      ];
      
      // Access the protected method for testing
      const result = (provider as any).standardizedAggregateMetric(metrics);
      
      expect(result).toBe(100);
    }, 60000);
  });

  describe('fetchRawMetrics', () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      
      // Mock permission check to return granted
      jest.spyOn(provider, 'checkPermissionsStatus')
        .mockResolvedValue({ status: 'granted', lastChecked: Date.now() });
        
      // Initialize provider
      provider['initialized'] = true;
    });

    it('should fetch multiple metric types', async () => {
      const startDate = new Date('2023-01-01T00:00:00.000Z');
      const endDate = new Date('2023-01-01T23:59:59.999Z');
      
      // Mock all required health kit methods
      const healthKitMocks = {
        getDailyStepCountSamples: jest.fn().mockImplementation((options, callback) => 
          callback(null, [{ value: 1000 }])),
        getDistanceWalkingRunning: jest.fn().mockImplementation((options, callback) => 
          callback(null, [{ value: 1500 }])),
        getHeartRateSamples: jest.fn().mockImplementation((options, callback) => 
          callback(null, [{ value: 75 }]))
      };
      
      Object.assign(AppleHealthKit, healthKitMocks);
      
      const result = await provider.fetchRawMetrics(startDate, endDate, ['steps', 'distance', 'heart_rate']);
      
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('distance');
      expect(result).toHaveProperty('heart_rate');
      expect(AppleHealthKit.getDailyStepCountSamples).toHaveBeenCalled();
      expect(AppleHealthKit.getDistanceWalkingRunning).toHaveBeenCalled();
      expect(AppleHealthKit.getHeartRateSamples).toHaveBeenCalled();
    });
  });

  describe('normalizeMetrics', () => {
    it('should normalize step metrics correctly', () => {
      const rawData = {
        steps: [
          { startDate: '2023-01-01T00:00:00.000Z', endDate: '2023-01-01T12:00:00.000Z', value: 500, unit: 'count' },
          { startDate: '2023-01-01T12:00:00.000Z', endDate: '2023-01-01T23:59:59.999Z', value: 500, unit: 'count' }
        ]
      };

      const normalized = provider.normalizeMetrics(rawData, 'steps');
      expect(normalized).toHaveLength(2);
      expect(normalized[0].type).toBe('steps');
      expect(normalized[0].value).toBe(500);
      expect(normalized[0].unit).toBe('count');
    });

    it('should normalize distance metrics correctly', () => {
      const rawData = {
        distance: [
          { startDate: '2023-01-01T00:00:00.000Z', endDate: '2023-01-01T12:00:00.000Z', value: 750, unit: 'meters' },
          { startDate: '2023-01-01T12:00:00.000Z', endDate: '2023-01-01T23:59:59.999Z', value: 750, unit: 'meters' }
        ]
      };

      const normalized = provider.normalizeMetrics(rawData, 'distance');
      expect(normalized).toHaveLength(2);
      expect(normalized[0].type).toBe('distance');
      expect(normalized[0].value).toBe(750);
      expect(normalized[0].unit).toBe('meters');
    });

    it('should handle empty data gracefully', () => {
      const rawData = {};
      const normalized = provider.normalizeMetrics(rawData, 'heart_rate');
      expect(normalized).toEqual([]);
    });
  });

  describe('getMetrics', () => {
    it('should handle errors in health data fetching', async () => {
      // Mock batchFetchHealthMetrics to return null
      jest.spyOn(provider as any, 'batchFetchHealthMetrics')
        .mockRejectedValue(new Error('Failed to fetch health data'));
      
      // Create empty metrics object for error case
      const emptyMetrics = {
        id: '',
        user_id: '',
        date: '',
        steps: null,
        distance: null,
        calories: null,
        heart_rate: null,
        exercise: null,
        basal_calories: null,
        flights_climbed: null,
        daily_score: 0,
        weekly_score: null,
        streak_days: null,
        last_updated: '',
        created_at: '',
        updated_at: '',
      };

      const result = await provider.getMetrics();
      expect(result).toEqual(emptyMetrics);
    });
  });
});