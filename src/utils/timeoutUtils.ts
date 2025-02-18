/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within the specified
 * time, it will reject with a timeout error.
 * 
 * @param promise The promise to wrap with a timeout
 * @param timeoutMs The timeout duration in milliseconds
 * @param errorMessage Custom error message for timeout
 * @returns A promise that will reject if the timeout is reached
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  return Promise.race([
    promise,
    timeoutPromise,
  ]).finally(() => {
    clearTimeout(timeoutHandle);
  });
};

/**
 * Default timeout durations for different operations
 */
export const DEFAULT_TIMEOUTS = {
  INITIALIZATION: 10000, // 10 seconds
  METRICS_FETCH: 15000,  // 15 seconds
  PERMISSION_CHECK: 5000, // 5 seconds
  SYNC: 30000,          // 30 seconds
  CLEANUP: 5000         // 5 seconds
} as const;
