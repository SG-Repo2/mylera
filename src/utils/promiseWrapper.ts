/**
 * Generic utility to wrap callback-based APIs in Promises
 * Particularly useful for platform-specific health APIs that use callbacks
 */
export function promisify<T>(fn: (...args: any[]) => void, ...args: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    fn(...args, (error: any, result: T) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}
