/**
 * Tests for the Provider Initialization Manager
 */
import { 
  initializeProviderWithTimeout, 
  initializeProviderWithRetry, 
  safelyCleanupProvider,
  TimeoutError,
  CancellationError
} from '../../utils/providerInitializationManager';
import { logger } from '../../utils/logger';

// Mock the logger
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  LogCategory: {
    Provider: 'provider',
    Timeout: 'timeout'
  }
}));

describe('Provider Initialization Manager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('initializeProviderWithTimeout', () => {
    it('should resolve when initialization completes before timeout', async () => {
      // Mock a successful initializer
      const mockInitializer = jest.fn().mockImplementation((signal: AbortSignal) => {
        return new Promise<string>(resolve => {
          setTimeout(() => resolve('Success'), 100);
        });
      });

      // Start the initialization
      const promise = initializeProviderWithTimeout(mockInitializer, 500, 'test-op');
      
      // Fast-forward past the initialization time
      jest.advanceTimersByTime(150);
      
      // Wait for the promise to resolve
      const result = await promise;
      
      // Verify the result and that the initializer was called
      expect(result).toBe('Success');
      expect(mockInitializer).toHaveBeenCalledTimes(1);
      expect(mockInitializer).toHaveBeenCalledWith(expect.any(AbortSignal));
    });

    it('should reject with TimeoutError when initialization times out', async () => {
      // Mock an initializer that never resolves
      const mockInitializer = jest.fn().mockImplementation((signal: AbortSignal) => {
        return new Promise<string>(resolve => {
          // This timeout is longer than our test timeout
          setTimeout(() => resolve('Too Late'), 1000);
        });
      });

      // Start the initialization
      const promise = initializeProviderWithTimeout(mockInitializer, 500, 'test-op');
      
      // Fast-forward past the timeout
      jest.advanceTimersByTime(600);
      
      // Verify the promise rejects with TimeoutError
      await expect(promise).rejects.toThrow(TimeoutError);
      expect(mockInitializer).toHaveBeenCalledTimes(1);
    });

    it('should handle cancellation via AbortController', async () => {
      // Mock an initializer that respects the abort signal
      const mockInitializer = jest.fn().mockImplementation((signal: AbortSignal) => {
        return new Promise<string>((resolve, reject) => {
          // Set up a listener for the abort signal
          signal.addEventListener('abort', () => {
            reject(new DOMException('Operation aborted', 'AbortError'));
          });
          
          // This would resolve if not aborted
          setTimeout(() => resolve('Success'), 300);
        });
      });

      // Start the initialization
      const promise = initializeProviderWithTimeout(mockInitializer, 500, 'test-op');
      
      // Get the AbortController and abort it manually
      const abortController = new AbortController();
      mockInitializer.mock.calls[0][0] = abortController.signal;
      abortController.abort();
      
      // Verify the promise rejects with CancellationError
      await expect(promise).rejects.toThrow(CancellationError);
    });
  });

  describe('initializeProviderWithRetry', () => {
    it('should succeed on the first attempt if initialization works', async () => {
      // Mock a successful initializer
      const mockInitializer = jest.fn().mockImplementation((signal: AbortSignal) => {
        return Promise.resolve('Success');
      });

      // Start the initialization with retry
      const result = await initializeProviderWithRetry(mockInitializer, {
        operationId: 'test-retry'
      });
      
      // Verify the result and that the initializer was called once
      expect(result).toBe('Success');
      expect(mockInitializer).toHaveBeenCalledTimes(1);
    });

    it('should retry on timeout and eventually succeed', async () => {
      // Mock an initializer that fails twice and then succeeds
      const mockInitializer = jest.fn()
        .mockImplementationOnce(() => {
          return Promise.reject(new TimeoutError('Timeout on first attempt'));
        })
        .mockImplementationOnce(() => {
          return Promise.reject(new TimeoutError('Timeout on second attempt'));
        })
        .mockImplementationOnce(() => {
          return Promise.resolve('Success on third attempt');
        });

      // Start the initialization with retry
      const promise = initializeProviderWithRetry(mockInitializer, {
        maxRetries: 2,
        baseDelay: 100,
        timeout: 500,
        operationId: 'test-retry'
      });
      
      // Fast-forward past the first retry delay
      jest.advanceTimersByTime(100);
      // Fast-forward past the second retry delay (with exponential backoff)
      jest.advanceTimersByTime(200);
      
      // Wait for the promise to resolve
      const result = await promise;
      
      // Verify the result and that the initializer was called three times
      expect(result).toBe('Success on third attempt');
      expect(mockInitializer).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      // Mock an initializer that fails with a non-retryable error
      const mockInitializer = jest.fn().mockImplementation(() => {
        return Promise.reject(new Error('Permission denied'));
      });

      // Start the initialization with retry
      const promise = initializeProviderWithRetry(mockInitializer, {
        operationId: 'test-non-retryable'
      });
      
      // Verify the promise rejects with the original error
      await expect(promise).rejects.toThrow('Permission denied');
      // Verify the initializer was called only once (no retries)
      expect(mockInitializer).toHaveBeenCalledTimes(1);
    });

    it('should fail after maximum retries', async () => {
      // Mock an initializer that always times out
      const mockInitializer = jest.fn().mockImplementation(() => {
        return Promise.reject(new TimeoutError('Always timeout'));
      });

      // Start the initialization with retry
      const promise = initializeProviderWithRetry(mockInitializer, {
        maxRetries: 2,
        baseDelay: 100,
        operationId: 'test-max-retries'
      });
      
      // Fast-forward past all retry delays
      jest.advanceTimersByTime(100);  // First retry
      jest.advanceTimersByTime(200);  // Second retry (exponential backoff)
      
      // Verify the promise rejects after all retries
      await expect(promise).rejects.toThrow(TimeoutError);
      expect(mockInitializer).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('safelyCleanupProvider', () => {
    it('should complete cleanup successfully', async () => {
      // Mock a successful cleanup function
      const mockCleanup = jest.fn().mockResolvedValue(undefined);
      
      // Call the safelyCleanupProvider function
      await safelyCleanupProvider(mockCleanup, 500, 'test-cleanup');
      
      // Verify the cleanup function was called
      expect(mockCleanup).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup timeout gracefully', async () => {
      // Mock a cleanup function that never resolves
      const mockCleanup = jest.fn().mockImplementation(() => {
        return new Promise<void>(resolve => {
          setTimeout(() => resolve(), 1000);
        });
      });
      
      // Call the safelyCleanupProvider function
      const promise = safelyCleanupProvider(mockCleanup, 500, 'test-cleanup-timeout');
      
      // Fast-forward past the timeout
      jest.advanceTimersByTime(600);
      
      // Verify the promise resolves (doesn't throw) despite the timeout
      await promise;
      
      // Verify the cleanup function was called
      expect(mockCleanup).toHaveBeenCalledTimes(1);
      // Verify a warning was logged
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock a cleanup function that throws an error
      const mockCleanup = jest.fn().mockRejectedValue(new Error('Cleanup failed'));
      
      // Call the safelyCleanupProvider function
      await safelyCleanupProvider(mockCleanup, 500, 'test-cleanup-error');
      
      // Verify the cleanup function was called
      expect(mockCleanup).toHaveBeenCalledTimes(1);
      // Verify a warning was logged
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});