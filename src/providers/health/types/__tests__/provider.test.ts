import { BaseHealthProvider } from '../provider';
import { LogCategory } from '@/src/utils/logger';
import { HealthProviderPermissionError } from '../errors';
import { NormalizedMetric, RawHealthData, HealthMetrics } from '../metrics';
import { PermissionState, PermissionStatus, PermissionManager } from '../permissions';
import { MetricType } from '@/src/types/metrics';
// Mock standardization functions from normalizeHealthData
jest.mock('@/src/utils/health/normalizeHealthData', () => ({
  standardizeHeartRateCalculation: jest.fn((values: number[]) => 
    values.length > 0 ? Math.round(values.reduce((sum: number, v: number) => sum + v, 0) / values.length) : 0
  ),
  standardizeStepsCalculation: jest.fn((values: number[]) => 
    values.length > 0 ? values.reduce((sum: number, v: number) => sum + v, 0) : 0
  ),
  standardizeCaloriesCalculation: jest.fn((values: number[]) => 
    values.length > 0 ? Math.round(values.reduce((sum: number, v: number) => sum + v, 0)) : 0
  ),
  standardizeDistanceCalculation: jest.fn((values: number[]) => 
    values.length > 0 ? Math.round(values.reduce((sum: number, v: number) => sum + v, 0)) : 0
  )
}));

// Mock PermissionManager
jest.mock('../permissions', () => {
  const originalModule = jest.requireActual('../permissions');
  
  return {
    ...originalModule,
    PermissionManager: jest.fn().mockImplementation(() => ({
      getPermissionState: jest.fn().mockResolvedValue(null),
      updatePermissionState: jest.fn().mockResolvedValue(undefined),
      clearCache: jest.fn().mockResolvedValue(undefined),
      handlePermissionError: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

// Create a concrete implementation of BaseHealthProvider for testing
class TestHealthProvider extends BaseHealthProvider {
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async fetchRawMetrics(): Promise<RawHealthData> {
    return {};
  }

  async getMetrics(): Promise<HealthMetrics> {
    return {
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
  }

  async requestPermissions(): Promise<PermissionStatus> {
    return 'granted';
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    return { status: 'granted', lastChecked: Date.now() };
  }
}

// Create a test helper class instead of using @ts-ignore
class TestableHealthProvider extends BaseHealthProvider {
  // Expose protected methods for testing
  public testStandardizedAggregateMetric(metrics: NormalizedMetric[]): number {
    return this.standardizedAggregateMetric(metrics);
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async fetchRawMetrics(): Promise<RawHealthData> {
    return {};
  }

  async requestPermissions(): Promise<PermissionStatus> {
    return 'granted';
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    return { status: 'granted', lastChecked: Date.now() };
  }

  async getMetrics(): Promise<HealthMetrics> {
    return {
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
  const logger = require('@/src/utils/logger').logger;
  const PermissionManagerMock = require('../permissions').PermissionManager;

  beforeEach(() => {
    provider = new TestHealthProvider();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  // Always restore timers in afterEach
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('standardizedAggregateMetric', () => {
    it('should return 0 for empty metrics array', () => {
      const testProvider = new TestableHealthProvider();
      const result = testProvider.testStandardizedAggregateMetric([]);
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

      const testProvider = new TestableHealthProvider();
      const result = testProvider.testStandardizedAggregateMetric(heartRateMetrics);
      
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

      const testProvider = new TestableHealthProvider();
      const result = testProvider.testStandardizedAggregateMetric(stepsMetrics);
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

      const testProvider = new TestableHealthProvider();
      const result = testProvider.testStandardizedAggregateMetric(metrics);
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

  describe('initializePermissions', () => {
    it('should create a new PermissionManager with the given userId', async () => {
      PermissionManagerMock.mockClear();
      
      const userId = 'test-user-123';
      await provider.initializePermissions(userId);
      
      expect(PermissionManagerMock).toHaveBeenCalledWith(userId);
      expect(provider.getPermissionManager()).not.toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        LogCategory.Health,
        expect.stringContaining('Initializing permissions')
      );
    });
    
    it('should throw error if PermissionManager creation fails', async () => {
      PermissionManagerMock.mockImplementationOnce(() => null);
      
      const userId = 'test-user-123';
      
      await provider.initializePermissions(userId)
        .catch(error => {
          expect(error.message).toBe('Failed to initialize permission manager');
          expect(logger.error).toHaveBeenCalled();
        });
    });
  });
  describe('initializeWithPermissions', () => {
    it('should call initialize and initializePermissions in sequence', async () => {
      const initializeSpy = jest.spyOn(provider, 'initialize');
      const initPermissionsSpy = jest.spyOn(provider, 'initializePermissions');
      
      const userId = 'test-user-123';
      await provider.initializeWithPermissions(userId);
      
      expect(initializeSpy).toHaveBeenCalled();
      expect(initPermissionsSpy).toHaveBeenCalledWith(userId);
      expect(provider['initialized']).toBe(true);
      expect(provider['lastInitializationTime']).toBeGreaterThan(0);
    });
    
    it('should handle errors during initialization', async () => {
      const initializeSpy = jest.spyOn(provider, 'initialize')
        .mockRejectedValueOnce(new Error('Initialization error'));
      
      const userId = 'test-user-123';
      
      await expect(provider.initializeWithPermissions(userId)).rejects.toThrow('Initialization error');
      expect(provider['initialized']).toBe(false);
      expect(provider['initializationInProgress']).toBe(false);
    });
    
    it('should wait for ongoing initialization to complete', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      
      provider['initializationInProgress'] = true;
      
      // Create a promise that resolves after a delay
      const initPromise = new Promise<void>(resolve => {
        setTimeout(() => {
          provider['initializationInProgress'] = false;
          provider['initialized'] = true;
          resolve();
        }, 1000);
      });
      
      const initSpy = jest.spyOn(provider, 'initialize')
        .mockResolvedValue(undefined);
      
      // Start the initialization
      const promise = provider.initializeWithPermissions('test-user');
      
      // Advance timers
      jest.advanceTimersByTime(1500);
      
      await promise;
      
      expect(initSpy).not.toHaveBeenCalled();
      expect(provider['initialized']).toBe(true);
      
      jest.useRealTimers();
    }, 60000);

    it('should throw timeout error if initialization takes too long', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      
      provider['initializationInProgress'] = true;
      
      const promise = provider.initializeWithPermissions('test-user');
      
      // Advance past the timeout
      jest.advanceTimersByTime(3000);
      
      await expect(promise).rejects.toThrow('Health provider initialization timeout');
      
      jest.useRealTimers();
    }, 60000);
  });
  
  describe('safeInitialize', () => {
    it('should initialize provider if not already initialized', async () => {
      const initializeSpy = jest.spyOn(provider, 'initialize');
      const initPermissionsSpy = jest.spyOn(provider, 'initializePermissions');
      
      provider['initialized'] = false;
      provider['permissionManager'] = null;
      
      const userId = 'test-user-123';
      await provider.safeInitialize(userId);
      
      expect(initializeSpy).toHaveBeenCalled();
      expect(initPermissionsSpy).toHaveBeenCalledWith(userId);
    });
    
    it('should skip provider initialization if already initialized', async () => {
      const initializeSpy = jest.spyOn(provider, 'initialize');
      const initPermissionsSpy = jest.spyOn(provider, 'initializePermissions');
      
      provider['initialized'] = true;
      provider['permissionManager'] = null;
      
      const userId = 'test-user-123';
      await provider.safeInitialize(userId);
      
      expect(initializeSpy).not.toHaveBeenCalled();
      expect(initPermissionsSpy).toHaveBeenCalledWith(userId);
    });
    
    it('should return permission status after initialization', async () => {
      provider['initialized'] = true;
      
      // Mock permission manager
      provider['permissionManager'] = {
        getPermissionState: jest.fn(),
        updatePermissionState: jest.fn(),
        clearCache: jest.fn(),
        handlePermissionError: jest.fn()
      } as any;
      
      const checkStatusSpy = jest.spyOn(provider, 'checkPermissionsStatus')
        .mockResolvedValueOnce({ status: 'granted', lastChecked: Date.now() });
      
      const userId = 'test-user-123';
      const result = await provider.safeInitialize(userId);
      
      expect(result).toBe('granted');
      expect(checkStatusSpy).toHaveBeenCalled();
    });
    
    it('should handle permission timeout', async () => {
      provider['initialized'] = true;
      provider['permissionManager'] = {} as any;
      
      // Mock checkPermissionsStatus to never resolve (simulate timeout)
      jest.spyOn(provider, 'checkPermissionsStatus').mockImplementation(() => {
        return new Promise(resolve => {
          // Never resolve
        });
      });
      
      // Mock the Promise.race to resolve the timeout first
      const originalRace = Promise.race;
      const raceSpy = jest.spyOn(Promise, 'race').mockImplementation(() => 
        Promise.reject(new Error('Permission check timeout'))
      );
      
      const userId = 'test-user-123';
      const result = await provider.safeInitialize(userId);
      
      // Should return not_determined on error
      expect(result).toBe('not_determined');
      
      // Restore original Promise.race
      raceSpy.mockRestore();
      Promise.race = originalRace;
    });
    
    it('should return not_determined on error', async () => {
      jest.spyOn(provider, 'initialize')
        .mockRejectedValueOnce(new Error('Initialization error'));
      
      const userId = 'test-user-123';
      const result = await provider.safeInitialize(userId);
      
      expect(result).toBe('not_determined');
      expect(console.error).toHaveBeenCalled();
    });
    
    it('should handle unexpected permission state formats', async () => {
      provider['initialized'] = true;
      provider['permissionManager'] = {} as any;
      
      // Mock checkPermissionsStatus to return an unexpected format
      jest.spyOn(provider, 'checkPermissionsStatus')
        .mockResolvedValueOnce(42 as any);
      
      const userId = 'test-user-123';
      const result = await provider.safeInitialize(userId);
      
      expect(result).toBe('not_determined');
      expect(console.warn).toHaveBeenCalled();
    });
  });
  
  describe('handlePermissionDenial', () => {
    it('should clear the permission cache if permission manager exists', async () => {
      // Create a mock permission manager
      provider['permissionManager'] = {
        clearCache: jest.fn().mockResolvedValueOnce(undefined)
      } as any;
      
      await provider.handlePermissionDenial();
      
      expect((provider['permissionManager'] as any).clearCache).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        LogCategory.Health,
        expect.stringContaining('Handling permission denial')
      );
    });
    
    it('should log a warning if permission manager is null', async () => {
      provider['permissionManager'] = null;
      
      await provider.handlePermissionDenial();
      
      expect(logger.warn).toHaveBeenCalledWith(
        LogCategory.Health,
        expect.stringContaining('Permission manager is null')
      );
    });
    
    it('should handle errors during cache clearing', async () => {
      // Create a mock permission manager that throws when clearCache is called
      provider['permissionManager'] = {
        clearCache: jest.fn().mockRejectedValueOnce(new Error('Cache clearing error'))
      } as any;
      
      await provider.handlePermissionDenial();
      
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('cleanup', () => {
    it('should reset state variables', async () => {
      // Set initial state
      provider['initialized'] = true;
      provider['lastSyncTime'] = new Date();
      provider['supportedMetricTypes'] = ['steps'] as MetricType[];
      
      // Create a mock permission manager
      provider['permissionManager'] = {
        clearCache: jest.fn().mockResolvedValueOnce(undefined)
      } as any;
      
      await provider.cleanup();
      
      expect(provider['initialized']).toBe(false);
      expect(provider['lastSyncTime']).toBeNull();
      expect(provider['supportedMetricTypes']).toBeNull();
      expect(provider['permissionManager']).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        LogCategory.Health,
        expect.stringContaining('Cleaning up provider')
      );
    });
    
    it('should handle errors during permission manager clearCache', async () => {
      // Create a mock permission manager that throws when clearCache is called
      provider['permissionManager'] = {
        clearCache: jest.fn().mockRejectedValueOnce(new Error('Cache clearing error'))
      } as any;
      
      await provider.cleanup();
      
      expect(logger.error).toHaveBeenCalled();
      expect(provider['permissionManager']).toBeNull(); // Still clears the permission manager
    });
  });
  
  describe('normalizeMetrics', () => {
    it('should return empty array for empty input', () => {
      const rawData: RawHealthData = {};
      const result = provider.normalizeMetrics(rawData, 'steps');
      
      expect(result).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        LogCategory.Health,
        expect.stringContaining('No steps data to normalize')
      );
    });
    
    it('should transform raw data into normalized format', () => {
      const now = new Date();
      const rawData: RawHealthData = {
        steps: [
          { 
            startDate: now.toISOString(), 
            endDate: now.toISOString(), 
            value: 1000,
            unit: 'count'
          },
          {
            startDate: now.toISOString(), 
            endDate: now.toISOString(), 
            value: 2000,
            unit: 'count'
          }
        ]
      };
      
      // Mock standardizeMetric to return a simple sum
      jest.spyOn(provider as any, 'standardizeMetric')
        .mockReturnValueOnce(3000);
      
      const result = provider.normalizeMetrics(rawData, 'steps');
      
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(3000);
      expect(result[0].unit).toBe('count');
      expect(result[0].type).toBe('steps');
      expect(provider['standardizeMetric']).toHaveBeenCalledWith('steps', [1000, 2000]);
    });
    
    it('should use default unit if not provided in raw data', () => {
      const getDefaultUnitSpy = jest.spyOn(provider as any, 'getDefaultUnitForType')
        .mockReturnValue('count');
      
      const now = new Date();
      const rawData = {
        steps: [{ 
          startDate: now.toISOString(), 
          endDate: now.toISOString(), 
          value: 1000 
          // No unit provided
        }]
      };
      
      const result = provider.normalizeMetrics(rawData as RawHealthData, 'steps');
      
      expect(result[0].unit).toBe('count');
      expect(getDefaultUnitSpy).toHaveBeenCalledWith('steps');
    });
    
    it('should handle errors during normalization', () => {
      const now = new Date();
      const rawData: RawHealthData = {
        steps: [
          { 
            startDate: now.toISOString(), 
            endDate: now.toISOString(), 
            value: 1000,
            unit: 'count'
          }
        ]
      };
      
      // Mock standardizeMetric to throw an error
      jest.spyOn(provider as any, 'standardizeMetric')
        .mockImplementationOnce(() => { throw new Error('Normalization error'); });
      
      const result = provider.normalizeMetrics(rawData, 'steps');
      
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('getLastSyncTime and setLastSyncTime', () => {
    it('should get and set the lastSyncTime correctly', async () => {
      // Initially null
      expect(await provider.getLastSyncTime()).toBeNull();
      
      // Set a time
      const syncTime = new Date();
      await provider.setLastSyncTime(syncTime);
      
      // Should now return the set time
      expect(await provider.getLastSyncTime()).toBe(syncTime);
    });
  });
  
  describe('isAvailable', () => {
    it('should return true by default', async () => {
      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });
  });
  
  describe('getSupportedMetricTypes', () => {
    it('should return cached types if available', async () => {
      // Set cached types
      provider['supportedMetricTypes'] = ['steps', 'heart_rate'] as MetricType[];
      
      const result = await provider.getSupportedMetricTypes();
      
      expect(result).toEqual(['steps', 'heart_rate']);
    });
    
    it('should create and cache default types if not cached', async () => {
      // Ensure no cached types
      provider['supportedMetricTypes'] = null;
      
      const result = await provider.getSupportedMetricTypes();
      
      // Should return default types
      expect(result).toContain('steps');
      expect(result).toContain('distance');
      expect(result).toContain('calories');
      expect(result).toContain('heart_rate');
      expect(result).toContain('exercise');
      expect(result).toContain('basal_calories');
      expect(result).toContain('flights_climbed');
      
      // Should have cached the types
      expect(provider['supportedMetricTypes']).toEqual(result);
    });
  });
  
  describe('validateMetricValue', () => {
    it('should validate steps correctly', () => {
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(5000, 'steps')).toBe(true);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(-1, 'steps')).toBe(false);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(200000, 'steps')).toBe(false); // > 100k limit
    });
    
    it('should validate distance correctly', () => {
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(5000, 'distance')).toBe(true);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(-1, 'distance')).toBe(false);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(200000, 'distance')).toBe(false); // > 100k limit
    });
    
    it('should validate calories correctly', () => {
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(500, 'calories')).toBe(true);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(-1, 'calories')).toBe(false);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(20000, 'calories')).toBe(false); // > 10k limit
    });
    
    it('should validate heart rate correctly', () => {
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(75, 'heart_rate')).toBe(true);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(25, 'heart_rate')).toBe(false); // < 30
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(250, 'heart_rate')).toBe(false); // > 220
    });
    
    it('should validate exercise correctly', () => {
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(30, 'exercise')).toBe(true);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(-1, 'exercise')).toBe(false);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(2000, 'exercise')).toBe(false); // > 1440 (24h in minutes)
    });
    
    it('should validate basal calories correctly', () => {
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(1500, 'basal_calories')).toBe(true);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(-1, 'basal_calories')).toBe(false);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(20000, 'basal_calories')).toBe(false); // > 10k limit
    });
    
    it('should validate flights climbed correctly', () => {
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(10, 'flights_climbed')).toBe(true);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(-1, 'flights_climbed')).toBe(false);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(2000, 'flights_climbed')).toBe(false); // > 1000 limit
    });
    
    it('should reject NaN and infinite values', () => {
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(NaN, 'steps')).toBe(false);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(Infinity, 'steps')).toBe(false);
    });
    
    it('should handle unknown metric types', () => {
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(100, 'unknown_metric' as MetricType)).toBe(true);
      // @ts-ignore - Accessing protected method for testing
      expect(provider.validateMetricValue(-50, 'unknown_metric' as MetricType)).toBe(false);
    });
  });
  
  describe('retryOperation', () => {
    it('should return result on first attempt if successful', async () => {
      const operation = jest.fn().mockResolvedValueOnce('success');
      
      const result = await provider.retryOperation(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
    
    it('should retry on failure up to maxRetries', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success');
      
      const promise = provider.retryOperation(operation, 2, 100);
      
      // Advance through retries
      jest.advanceTimersByTime(500);
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      
      jest.useRealTimers();
    }, 60000);

    it('should throw the last error if all retries fail', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      
      const operation = jest.fn()
        .mockRejectedValue(new Error('Persistent failure'));
      
      const promise = provider.retryOperation(operation, 2, 100);
      
      // Advance through retries
      jest.advanceTimersByTime(500);
      
      await expect(promise).rejects.toThrow('Persistent failure');
      expect(operation).toHaveBeenCalledTimes(3);
      
      jest.useRealTimers();
    }, 60000);
    
    it('should apply exponential backoff', async () => {
      jest.useRealTimers(); // Need real timers to measure actual delay
      
      // Create mock timers
      const originalSetTimeout = global.setTimeout;
      const mockSetTimeout = jest.fn().mockImplementation((callback, ms) => {
        return originalSetTimeout(callback, 10); // Use a very short delay for tests
      });
      global.setTimeout = mockSetTimeout as unknown as typeof setTimeout;
      
      // Operation fails first 2 times, succeeds on 3rd try
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValueOnce('success');
      
      await provider.retryOperation(operation, 2, 1000);
      
      // Check the delay values - should follow exponential backoff
      expect(mockSetTimeout).toHaveBeenCalledTimes(2);
      expect(mockSetTimeout.mock.calls[0][1]).toBe(1000); // First retry: initial delay
      expect(mockSetTimeout.mock.calls[1][1]).toBe(2000); // Second retry: initial * 2
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });
  
  describe('standardizeError', () => {
    it('should call handleProviderError and return the result', () => {
      // Mock handleProviderError to return an error
      const mockError = new Error('Standardized error');
      jest.spyOn(provider as any, 'handleProviderError')
        .mockImplementationOnce(() => { throw mockError; });
      
      // @ts-ignore - Accessing protected method for testing
      const result = provider.standardizeError(new Error('Original error'));
      
      expect(result).toBe(mockError);
      expect(provider['handleProviderError']).toHaveBeenCalledWith(
        'standardizing error',
        expect.any(Error)
      );
    });
    
    it('should handle non-Error inputs', () => {
      // Mock handleProviderError to return an error
      const mockError = new Error('Standardized error');
      jest.spyOn(provider as any, 'handleProviderError')
        .mockImplementationOnce(() => { throw mockError; });
      
      // @ts-ignore - Accessing protected method for testing
      const result = provider.standardizeError('Not an error');
      
      expect(result).toBe(mockError);
      expect(provider['handleProviderError']).toHaveBeenCalledWith(
        'standardizing error',
        'Not an error'
      );
    });
    
    it('should return a default error if handleProviderError throws something unexpected', () => {
      // Mock handleProviderError to throw something that's not an Error
      jest.spyOn(provider as any, 'handleProviderError')
        .mockImplementationOnce(() => { throw 'Not an error object'; });
      
      // @ts-ignore - Accessing protected method for testing
      const result = provider.standardizeError(new Error('Original error'));
      
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Unknown error during standardization');
    });
  });
  
  describe('validateHealthData', () => {
    it('should call validateMetricValue for each numeric metric', () => {
      const data = {
        id: 'test-id',
        user_id: 'test-user',
        date: '2023-01-01',
        steps: 5000,
        distance: 3000,
        calories: 500,
        heart_rate: 75,
        exercise: 30,
        basal_calories: 1500,
        flights_climbed: 10,
        daily_score: 0,
        weekly_score: null,
        streak_days: null,
        last_updated: '',
        created_at: '',
        updated_at: '',
      };
      
      const validateSpy = jest.spyOn(provider as any, 'validateMetricValue')
        .mockReturnValue(true);
      
      provider['validateHealthData'](data);
      
      // Verify calls for each health metric (excluding daily_score)
      ['steps', 'distance', 'calories', 'heart_rate', 'exercise', 'basal_calories', 'flights_climbed']
        .forEach(metric => {
          expect(validateSpy).toHaveBeenCalledWith(data[metric as keyof typeof data], metric);
        });
      
      // Should not validate non-health metrics
      expect(validateSpy).not.toHaveBeenCalledWith(0, 'daily_score');
    });
  });
  describe('standardizeMetric', () => {
    it('should handle different metric types correctly', () => {
      const standardizeHeartRateCalculation = require('@/src/utils/health/normalizeHealthData').standardizeHeartRateCalculation;
      const standardizeStepsCalculation = require('@/src/utils/health/normalizeHealthData').standardizeStepsCalculation;
      const standardizeCaloriesCalculation = require('@/src/utils/health/normalizeHealthData').standardizeCaloriesCalculation;
      const standardizeDistanceCalculation = require('@/src/utils/health/normalizeHealthData').standardizeDistanceCalculation;
      
      const rawValues = [50, 60, 70];
      
      // Test for heart_rate
      // @ts-ignore - Accessing protected method for testing
      provider.standardizeMetric('heart_rate', rawValues);
      expect(standardizeHeartRateCalculation).toHaveBeenCalledWith(rawValues);
      
      // Test for steps
      // @ts-ignore - Accessing protected method for testing
      provider.standardizeMetric('steps', rawValues);
      expect(standardizeStepsCalculation).toHaveBeenCalledWith(rawValues);
      
      // Test for calories and basal_calories
      // @ts-ignore - Accessing protected method for testing
      provider.standardizeMetric('calories', rawValues);
      expect(standardizeCaloriesCalculation).toHaveBeenCalledWith(rawValues);
      
      // @ts-ignore - Accessing protected method for testing
      provider.standardizeMetric('basal_calories', rawValues);
      expect(standardizeCaloriesCalculation).toHaveBeenCalledWith(rawValues);
      
      // Test for distance
      // @ts-ignore - Accessing protected method for testing
      provider.standardizeMetric('distance', rawValues);
      expect(standardizeDistanceCalculation).toHaveBeenCalledWith(rawValues);
    });
    
    it('should handle empty arrays', () => {
      // @ts-ignore - Accessing protected method for testing
      const result = provider.standardizeMetric('steps', []);
      expect(result).toBe(0);
    });
    
    it('should handle flights_climbed with sum aggregation', () => {
      // @ts-ignore - Accessing protected method for testing
      const result = provider.standardizeMetric('flights_climbed', [5, 3, 2]);
      expect(result).toBe(10); // Sum of values
    });
    
    it('should handle exercise with sum and cap at 24 hours', () => {
      // @ts-ignore - Accessing protected method for testing
      const result = provider.standardizeMetric('exercise', [500, 600, 700]);
      expect(result).toBe(1440); // Capped at 1440 minutes (24 hours)
    });
    
    it('should handle unknown metrics with average', () => {
      // @ts-ignore - Accessing protected method for testing
      const result = provider.standardizeMetric('unknown_metric' as MetricType, [10, 20, 30]);
      expect(result).toBe(20); // Average
    });
    
    it('should handle negative values by filtering them out', () => {
      // @ts-ignore - Accessing protected method for testing
      const result = provider.standardizeMetric('flights_climbed', [5, -2, 3]);
      expect(result).toBe(8); // Sum of positive values only
    });
  });
  
  describe('ensurePermissionsInitialized', () => {
    it('should initialize permission manager if null', async () => {
      // Reset permission manager
      provider['permissionManager'] = null;
      
      // Mock initializePermissions
      const initPermissionsSpy = jest.spyOn(provider, 'initializePermissions')
        .mockResolvedValueOnce(undefined);
      
      // @ts-ignore - Accessing protected method for testing
      await provider.ensurePermissionsInitialized();
      
      expect(initPermissionsSpy).toHaveBeenCalledWith('temp-user-id');
      expect(logger.info).toHaveBeenCalled();
    });
    
    it('should not initialize if permission manager already exists', async () => {
      // Set permission manager
      provider['permissionManager'] = {} as any;
      
      // Mock initializePermissions
      const initPermissionsSpy = jest.spyOn(provider, 'initializePermissions');
      
      // @ts-ignore - Accessing protected method for testing
      await provider.ensurePermissionsInitialized();
      
      expect(initPermissionsSpy).not.toHaveBeenCalled();
    });
    
    it('should handle errors during initialization', async () => {
      // Reset permission manager
      provider['permissionManager'] = null;
      
      // Mock initializePermissions to throw
      jest.spyOn(provider, 'initializePermissions')
        .mockRejectedValueOnce(new Error('Initialization error'));
      
      // @ts-ignore - Accessing protected method for testing
      await provider.ensurePermissionsInitialized();
      
      // Should log the error but not throw
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('getDefaultUnitForType', () => {
    it('should return correct units for different metric types', () => {
      // @ts-ignore - Accessing protected method for testing
      expect(provider.getDefaultUnitForType('steps')).toBe('count');
      // @ts-ignore - Accessing protected method for testing
      expect(provider.getDefaultUnitForType('distance')).toBe('meters');
      // @ts-ignore - Accessing protected method for testing
      expect(provider.getDefaultUnitForType('calories')).toBe('kcal');
      // @ts-ignore - Accessing protected method for testing
      expect(provider.getDefaultUnitForType('heart_rate')).toBe('bpm');
      // @ts-ignore - Accessing protected method for testing
      expect(provider.getDefaultUnitForType('exercise')).toBe('minutes');
      // @ts-ignore - Accessing protected method for testing
      expect(provider.getDefaultUnitForType('basal_calories')).toBe('kcal');
      // @ts-ignore - Accessing protected method for testing
      expect(provider.getDefaultUnitForType('flights_climbed')).toBe('count');
      // @ts-ignore - Accessing protected method for testing
      expect(provider.getDefaultUnitForType('unknown_metric' as MetricType)).toBe('count'); // Default
    });
  });
  
  describe('ensureInitialized', () => {
    it('should call initialize if not initialized', async () => {
      // Reset initialized flag
      provider['initialized'] = false;
      
      // Mock initialize
      const initializeSpy = jest.spyOn(provider, 'initialize')
        .mockResolvedValueOnce(undefined);
      
      // @ts-ignore - Accessing protected method for testing
      await provider.ensureInitialized();
      
      expect(initializeSpy).toHaveBeenCalled();
      expect(provider['initialized']).toBe(true);
    });
    
    it('should do nothing if already initialized', async () => {
      // Set initialized flag
      provider['initialized'] = true;
      
      // Mock initialize
      const initializeSpy = jest.spyOn(provider, 'initialize');
      
      // @ts-ignore - Accessing protected method for testing
      await provider.ensureInitialized();
      
      expect(initializeSpy).not.toHaveBeenCalled();
    });
    
    it('should handle initialization errors', async () => {
      // Reset initialized flag
      provider['initialized'] = false;
      
      // Mock initialize to throw
      jest.spyOn(provider, 'initialize')
        .mockRejectedValueOnce(new Error('Initialization failed'));
      
      // @ts-ignore - Accessing protected method for testing
      await expect(provider.ensureInitialized()).rejects.toThrow('Health provider must be initialized before use');
      
      expect(console.error).toHaveBeenCalled();
      expect(provider['initialized']).toBe(false);
    });
  });

  // Test helper class for batch fetching
  class TestBatchProvider extends BaseHealthProvider {
    public fetchedTypes: MetricType[] = [];
    
    async initialize(): Promise<void> {
      this.initialized = true;
    }

    async fetchRawMetrics(): Promise<RawHealthData> {
      return {};
    }

    async getMetrics(): Promise<HealthMetrics> {
      return {
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
    }

    async requestPermissions(): Promise<PermissionStatus> {
      return 'granted';
    }

    async checkPermissionsStatus(): Promise<PermissionState> {
      return { status: 'granted', lastChecked: Date.now() };
    }

    public async testBatchFetch(startDate: Date, endDate: Date, types: MetricType[]): Promise<HealthMetrics> {
      this.fetchedTypes = types;
      return this.batchFetchHealthMetrics(startDate, endDate, types);
    }

    public setInitialized(value: boolean): void {
      this.initialized = value;
    }
  }

  describe('batchFetchHealthMetrics', () => {
    let batchProvider: TestBatchProvider;

    beforeEach(() => {
      batchProvider = new TestBatchProvider();
      batchProvider.setInitialized(true);
    });

    it('should fetch metrics for specified date range and types', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-02');
      const types = ['steps', 'heart_rate'] as MetricType[];

      const result = await batchProvider.testBatchFetch(startDate, endDate, types);

      // Verify the correct types were requested
      expect(batchProvider.fetchedTypes).toEqual(expect.arrayContaining(types));

      // Verify the result has expected format
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('heart_rate');
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('id');
      batchProvider.setInitialized(false);
    });

    it('should throw if not initialized', async () => {
      batchProvider.setInitialized(false);
      
      const startDate = new Date();
      const endDate = new Date();
      const types = ['steps'] as MetricType[];

      await expect(batchProvider.testBatchFetch(startDate, endDate, types))
        .rejects.toThrow('Health provider must be initialized before use');
    });

    it('should validate date range', async () => {
      const endDate = new Date('2023-01-01');
      const startDate = new Date('2023-01-02'); // Invalid: start after end
      const types = ['steps'] as MetricType[];

      await expect(batchProvider.testBatchFetch(startDate, endDate, types))
        .rejects.toThrow('Invalid date range');
    });

    it('should handle empty metrics array', async () => {
      const startDate = new Date();
      const endDate = new Date();
      const types: MetricType[] = [];

      const result = await batchProvider.testBatchFetch(startDate, endDate, types);

      expect(result.steps).toBeNull();
      expect(result.heart_rate).toBeNull();
      expect(result.distance).toBeNull();
    });

    it('should validate fetched data', async () => {
      const startDate = new Date();
      const endDate = new Date();
      const types = ['steps'] as MetricType[];

      // Mock validateHealthData to spy on calls
      const validateSpy = jest.spyOn(batchProvider as any, 'validateHealthData');

      await batchProvider.testBatchFetch(startDate, endDate, types);

      expect(validateSpy).toHaveBeenCalled();
    });
  });
});