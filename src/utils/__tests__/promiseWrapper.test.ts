import { promisify } from '../promiseWrapper';

describe('promiseWrapper', () => {
  describe('promisify', () => {
    it('should resolve with result when callback succeeds', async () => {
      const mockCallback = (arg1: string, callback: (error: null, result: number) => void) => {
        callback(null, 42);
      };

      const result = await promisify<number>(mockCallback, 'test');
      expect(result).toBe(42);
    });

    it('should reject with error when callback fails', async () => {
      const mockError = new Error('Test error');
      const mockCallback = (_arg1: string, callback: (error: Error, result: null) => void) => {
        callback(mockError, null);
      };

      await expect(promisify(mockCallback, 'test')).rejects.toThrow('Test error');
    });

    it('should pass multiple arguments to the callback function', async () => {
      const mockCallback = (
        arg1: string,
        arg2: number,
        callback: (error: null, result: string) => void
      ) => {
        callback(null, `${arg1}-${arg2}`);
      };

      const result = await promisify<string>(mockCallback, 'test', 123);
      expect(result).toBe('test-123');
    });

    it('should handle undefined result', async () => {
      const mockCallback = (_arg: string, callback: (error: null, result: undefined) => void) => {
        callback(null, undefined);
      };

      const result = await promisify<undefined>(mockCallback, 'test');
      expect(result).toBeUndefined();
    });

    it('should handle null result', async () => {
      const mockCallback = (_arg: string, callback: (error: null, result: null) => void) => {
        callback(null, null);
      };

      const result = await promisify<null>(mockCallback, 'test');
      expect(result).toBeNull();
    });
  });
});
