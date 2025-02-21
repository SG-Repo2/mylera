import { initializeProviderWithRetry } from '../providerInitializationManager';
import { HealthProviderInitializationError } from '../../providers/health/types/errors';
import { TimeoutError } from '../asyncUtils';
import type { HealthProvider } from '../../providers/health/types/provider';

// Mock HealthProvider for testing
class MockHealthProvider implements HealthProvider {
  initialize = jest.fn();
  cleanup = jest.fn();
  resetState = jest.fn();
  initializePermissions = jest.fn();
  requestPermissions = jest.fn();
  checkPermissionsStatus = jest.fn();
  getMetrics = jest.fn();
  handlePermissionDenial = jest.fn();
  getPermissionManager = jest.fn();
  isInitialized = jest.fn();
  fetchRawMetrics = jest.fn();
  normalizeMetrics = jest.fn();
}

describe('providerInitializationManager', () => {
  let mockProvider: MockHealthProvider;

  beforeEach(() => {
    jest.useFakeTimers();
    mockProvider = new MockHealthProvider();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('succeeds on first attempt', async () => {
    mockProvider.initialize.mockResolvedValueOnce(undefined);

    await initializeProviderWithRetry(mockProvider);

    expect(mockProvider.initialize).toHaveBeenCalledTimes(1);
    expect(mockProvider.cleanup).not.toHaveBeenCalled();
  });

  test('retries on failure and eventually succeeds', async () => {
    mockProvider.initialize
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValueOnce(undefined);

    const promise = initializeProviderWithRetry(mockProvider);
    
    // Fast-forward through retries
    for (let i = 0; i < 2; i++) {
      jest.advanceTimersByTime(1000 * Math.pow(2, i));
      await Promise.resolve();
    }

    await promise;

    expect(mockProvider.initialize).toHaveBeenCalledTimes(3);
    expect(mockProvider.cleanup).not.toHaveBeenCalled();
  });

  test('fails after max retries and cleans up', async () => {
    const error = new Error('Persistent failure');
    mockProvider.initialize.mockRejectedValue(error);

    const promise = initializeProviderWithRetry(mockProvider, { maxRetries: 2, timeout: 60000 });

    // Fast-forward through all retries
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(1000 * Math.pow(2, i));
      await Promise.resolve();
    }

    await expect(promise).rejects.toThrow(HealthProviderInitializationError);
    expect(mockProvider.initialize).toHaveBeenCalledTimes(3);
    expect(mockProvider.cleanup).toHaveBeenCalled();
  });

  test('handles timeout during initialization', async () => {
    mockProvider.initialize.mockImplementation(() => new Promise(resolve => {
      setTimeout(resolve, 50000); // Longer than default timeout
    }));

    const promise = initializeProviderWithRetry(mockProvider, { timeout: 1000 });
    
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    await expect(promise).rejects.toThrow(HealthProviderInitializationError);
    expect(mockProvider.cleanup).toHaveBeenCalled();
  });

  test('respects custom configuration', async () => {
    mockProvider.initialize
      .mockRejectedValueOnce(new Error('Failure'))
      .mockResolvedValueOnce(undefined);

    const config = {
      maxRetries: 1,
      baseDelay: 500,
      maxDelay: 1000,
      operationId: 'test-init'
    };

    const promise = initializeProviderWithRetry(mockProvider, config);
    
    jest.advanceTimersByTime(500);
    await Promise.resolve();

    await promise;

    expect(mockProvider.initialize).toHaveBeenCalledTimes(2);
  });

  test('handles cleanup errors gracefully', async () => {
    mockProvider.initialize.mockRejectedValue(new Error('Init failure'));
    mockProvider.cleanup.mockRejectedValue(new Error('Cleanup failure'));

    const promise = initializeProviderWithRetry(mockProvider, { maxRetries: 0 });
    
    await expect(promise).rejects.toThrow(HealthProviderInitializationError);
    expect(mockProvider.cleanup).toHaveBeenCalled();
  });

  describe('cancellation', () => {
    it('should respect external abort signal', async () => {
      const abortController = new AbortController();
      
      // Mock a long-running initialization that listens to abort signal
      mockProvider.initialize.mockImplementation(() => 
        new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 5000);
          abortController.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Operation cancelled'));
          });
        })
      );

      const promise = initializeProviderWithRetry(mockProvider, {
        maxRetries: 0,
      });

      // Trigger abort
      abortController.abort();

      // Need to advance timers and flush promises
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise).rejects.toThrow('Operation cancelled');
      expect(mockProvider.cleanup).toHaveBeenCalled();
    });

    it('should cleanup on abort', async () => {
      const abortController = new AbortController();
      
      // Mock initialization that properly handles abort
      mockProvider.initialize.mockImplementation(() => 
        new Promise((resolve, reject) => {
          const checkAbort = () => {
            if (abortController.signal.aborted) {
              reject(new Error('Operation cancelled'));
            }
          };
          
          // Check immediately in case already aborted
          checkAbort();
          
          // Listen for future aborts
          abortController.signal.addEventListener('abort', checkAbort);
          
          // Set up the long operation
          const timeout = setTimeout(resolve, 5000);
          return () => {
            clearTimeout(timeout);
            abortController.signal.removeEventListener('abort', checkAbort);
          };
        })
      );

      const promise = initializeProviderWithRetry(mockProvider, {
        maxRetries: 0,
      });

      // Advance timers a bit before aborting
      jest.advanceTimersByTime(100);
      abortController.abort();
      await Promise.resolve();

      await expect(promise).rejects.toThrow('Operation cancelled');
      expect(mockProvider.cleanup).toHaveBeenCalled();
    });
  });
}); 