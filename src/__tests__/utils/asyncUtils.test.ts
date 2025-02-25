import { 
  callWithTimeout, 
  fetchWithCancellation, 
  retryWithBackoff,
  TimeoutError,
  CancellationError
} from '@/src/utils/asyncUtils';

describe('asyncUtils', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('callWithTimeout', () => {
    it('should resolve when promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = callWithTimeout(promise, 1000, 'Timeout');
      
      await Promise.resolve(); // Let promise microtasks execute
      jest.runAllTimers();
      
      await expect(result).resolves.toBe('success');
    });

    it('should reject with TimeoutError when operation times out', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 2000));
      const result = callWithTimeout(promise, 100, 'Operation timed out');
      
      jest.advanceTimersByTime(100);
      
      await expect(result).rejects.toThrow(TimeoutError);
    });

    it('should properly clean up timeout on early resolution', async () => {
      const promise = Promise.resolve('quick');
      const result = callWithTimeout(promise, 1000, 'Timeout');
      
      await Promise.resolve();
      jest.runAllTimers();
      
      await expect(result).resolves.toBe('quick');
    });

    it('should properly clean up timeout on error', async () => {
      const promise = Promise.reject(new Error('fail'));
      const result = callWithTimeout(promise, 1000, 'Timeout');
      
      await Promise.resolve();
      jest.runAllTimers();
      
      await expect(result).rejects.toThrow('fail');
    });
  });

  describe('fetchWithCancellation', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('should handle successful fetch within timeout', async () => {
      const mockFetch = global.fetch as jest.Mock;
      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockImplementation(() => Promise.resolve(mockResponse));

      const result = fetchWithCancellation('https://api.example.com', {}, 1000);
      
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      
      await expect(result).resolves.toEqual(mockResponse);
    });

    it('should handle fetch errors', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = fetchWithCancellation('https://api.example.com');
      
      await Promise.resolve();
      
      await expect(result).rejects.toThrow('Network error');
    });

    it('should pass fetch options correctly', async () => {
      const mockFetch = global.fetch as jest.Mock;
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };
      
      await fetchWithCancellation('https://api.example.com', options);
      
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com', {
        ...options,
        signal: expect.any(AbortSignal)
      });
    });

    it('should timeout on long-running requests', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 2000)));

      const result = fetchWithCancellation('https://api.example.com', {}, 100);
      
      jest.advanceTimersByTime(100);
      
      await expect(result).rejects.toThrow(TimeoutError);
    });

    it('should respect external abort signal', async () => {
      const controller = new AbortController();
      const fetchPromise = fetchWithCancellation(
        'https://api.example.com',
        {},
        1000,
        controller.signal
      );

      controller.abort();
      await expect(fetchPromise).rejects.toThrow(CancellationError);
    });
  });

  describe('retryWithBackoff', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should retry failed operations', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockResolvedValue('success');

      const resultPromise = retryWithBackoff(operation, 3, 100);
      
      // Run all timers and resolve promises in sequence
      for (let i = 0; i < 2; i++) {
        jest.advanceTimersByTime(100 * Math.pow(2, i));
        await Promise.resolve(); // Flush promise queue
      }
      
      const result = await resultPromise;
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    }, 10000); // Increase timeout for this specific test

    it('should respect max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      const result = retryWithBackoff(operation, 2, 100);
      
      for (let i = 0; i <= 2; i++) {
        jest.advanceTimersByTime(100 * Math.pow(2, i));
        await Promise.resolve();
      }
      
      await expect(result).rejects.toThrow('Always fails');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });
});