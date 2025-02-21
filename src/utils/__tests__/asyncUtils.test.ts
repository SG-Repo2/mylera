import { 
  callWithTimeout, 
  fetchWithCancellation, 
  retryWithBackoff,
  TimeoutError,
  CancellationError
} from '../asyncUtils';

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

    it('should cancel fetch on timeout', async () => {
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
    it('should retry failed operations', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockResolvedValue('success');

      const result = retryWithBackoff(operation, 3, 100);
      
      for (let i = 0; i < 2; i++) {
        jest.advanceTimersByTime(100 * Math.pow(2, i));
        await Promise.resolve();
      }
      
      await expect(result).resolves.toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

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