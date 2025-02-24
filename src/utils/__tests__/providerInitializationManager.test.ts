import { initializeProviderWithRetry } from '../providerInitializationManager';
import { HealthProviderInitializationError } from '../../providers/health/types/errors';
import { TimeoutError } from '../asyncUtils';
import type { HealthProvider } from '../../providers/health/types/provider';

// Mock HealthProvider for testing
class MockHealthProvider implements HealthProvider {
  private userId: string | null = null;
  private initialized = false;
  
  initialize = jest.fn().mockImplementation(() => {
    this.initialized = true;
    return Promise.resolve();
  });
  cleanup = jest.fn();
  getUserId = jest.fn().mockImplementation(() => this.userId);
  setUserId = jest.fn().mockImplementation((id: string) => { this.userId = id; });
  isInitialized = jest.fn().mockImplementation(() => this.initialized);
  resetState = jest.fn();
  initializePermissions = jest.fn();
  requestPermissions = jest.fn();
  checkPermissionsStatus = jest.fn();
  getMetrics = jest.fn();
  handlePermissionDenial = jest.fn();
  getPermissionManager = jest.fn();
  fetchRawMetrics = jest.fn();
  normalizeMetrics = jest.fn();
}

describe('providerInitializationManager', () => {
  let mockProvider: MockHealthProvider;

  beforeEach(() => {
    jest.useFakeTimers();
    mockProvider = new MockHealthProvider();
    mockProvider.setUserId('test-user');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Initialization Success', () => {
    it('successfully initializes within timeout', async () => {
      mockProvider.initialize.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const promise = initializeProviderWithRetry(mockProvider, {
        timeout: 1000,
        operationId: 'test'
      });

      jest.advanceTimersByTime(150);
      await promise;

      expect(mockProvider.initialize).toHaveBeenCalledTimes(1);
      expect(mockProvider.isInitialized()).toBe(true);
      expect(mockProvider.cleanup).not.toHaveBeenCalled();
    });
  });

  describe('Timeout Handling', () => {
    it('throws TimeoutError if initialization exceeds timeout', async () => {
      mockProvider.initialize.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      const promise = initializeProviderWithRetry(mockProvider, {
        timeout: 1000,
        operationId: 'test'
      });

      jest.advanceTimersByTime(1100);
      await expect(promise).rejects.toThrow(HealthProviderInitializationError);
      expect(mockProvider.cleanup).toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('retries with exponential backoff and eventually succeeds', async () => {
      const attempts: number[] = [];
      const startTime = Date.now();

      mockProvider.initialize
        .mockImplementationOnce(() => {
          attempts.push(Date.now() - startTime);
          return Promise.reject(new Error('First failure'));
        })
        .mockImplementationOnce(() => {
          attempts.push(Date.now() - startTime);
          return Promise.reject(new Error('Second failure'));
        })
        .mockImplementationOnce(() => {
          attempts.push(Date.now() - startTime);
          return Promise.resolve();
        });

      const promise = initializeProviderWithRetry(mockProvider, {
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 5000,
        operationId: 'test'
      });

      // Advance through retries
      for (let i = 0; i < 2; i++) {
        jest.advanceTimersByTime(1000 * Math.pow(2, i));
        await Promise.resolve();
      }

      await promise;

      expect(mockProvider.initialize).toHaveBeenCalledTimes(3);
      expect(attempts[1] - attempts[0]).toBeGreaterThanOrEqual(1000); // First retry after 1s
      expect(attempts[2] - attempts[1]).toBeGreaterThanOrEqual(2000); // Second retry after 2s
    });
  });

  describe('Cancellation', () => {
    it('respects abort signal', async () => {
      const abortController = new AbortController();
      
      mockProvider.initialize.mockImplementation(() => 
        new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 1000);
          abortController.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Operation cancelled'));
          });
        })
      );

      const promise = initializeProviderWithRetry(mockProvider, {
        operationId: 'test'
      });

      abortController.abort();
      jest.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('Operation cancelled');
      expect(mockProvider.cleanup).toHaveBeenCalled();
    });
  });
}); 