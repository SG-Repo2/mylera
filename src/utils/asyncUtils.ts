import { logger, LogCategory } from './logger';

/**
 * Default timeout values in milliseconds
 */
export const DEFAULT_TIMEOUTS = {
  API_CALL: 30000,        // 30 seconds
  INITIALIZATION: 45000,  // 45 seconds
  PERMISSION: 20000,      // 20 seconds
  CLEANUP: 10000,         // 10 seconds
  PERMISSION_CHECK: 5000  // 5 seconds
} as const;

/**
 * Custom error class for timeout-related errors
 */
export class TimeoutError extends Error {
  constructor(message: string, public readonly operationId?: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Custom error class for cancellation-related errors
 */
export class CancellationError extends Error {
  constructor(message: string, public readonly operationId?: string) {
    super(message);
    this.name = 'CancellationError';
  }
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within the specified
 * time, it will reject with a TimeoutError.
 * 
 * @param promise - The promise to wrap with a timeout
 * @param ms - Timeout duration in milliseconds
 * @param errorMessage - Custom error message for timeout
 * @param operationId - Optional identifier for the operation (useful for logging)
 * @returns Promise that resolves with the original promise result or rejects on timeout
 * @throws {TimeoutError} When the operation times out
 * @throws {Error} When the operation fails for other reasons
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await callWithTimeout(
 *     fetchData(),
 *     5000,
 *     'Data fetch timed out',
 *     'fetch-123'
 *   );
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     console.error('Operation timed out:', error.operationId);
 *   }
 * }
 * ```
 */
export async function callWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string,
  operationId?: string
): Promise<T> {
  // Log operation start
  logger.debug(
    LogCategory.Performance,
    'Starting timed operation',
    operationId,
    undefined,
    { timeout: ms }
  );

  let timeoutId: NodeJS.Timeout | undefined;
  let isTimedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      isTimedOut = true;
      reject(new TimeoutError(errorMessage, operationId));
    }, ms);
  });

  try {
    const startTime = Date.now();
    const result = await Promise.race([promise, timeoutPromise]);
    
    // Log successful completion
    logger.debug(
      LogCategory.Performance,
      'Operation completed successfully',
      operationId,
      undefined,
      { executionTime: Date.now() - startTime }
    );
    
    return result;
  } catch (error) {
    // Log error with appropriate category and details
    logger.error(
      isTimedOut ? LogCategory.Timeout : LogCategory.Error,
      isTimedOut ? 'Operation timed out' : 'Operation failed',
      operationId,
      undefined,
      { error, timeout: ms }
    );
    
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Wraps a fetch call with timeout and cancellation support
 * 
 * @param input - URL or Request object
 * @param init - Fetch options
 * @param timeoutMs - Timeout duration in milliseconds
 * @param signal - Optional AbortSignal for cancellation
 * @param operationId - Optional identifier for the operation
 * @returns Promise that resolves with the fetch response
 * @throws {TimeoutError} When the fetch times out
 * @throws {CancellationError} When the operation is cancelled
 * @throws {Error} For other fetch-related errors
 */
export async function fetchWithCancellation(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUTS.API_CALL,
  signal?: AbortSignal,
  operationId?: string
): Promise<Response> {
  const controller = new AbortController();
  const fetchSignal = controller.signal;

  // Create cleanup function for abort listener
  let removeAbortListener: (() => void) | undefined;

  // Combine with external signal if provided
  if (signal) {
    const abortHandler = () => {
      controller.abort();
      throw new CancellationError('Operation was cancelled', operationId);
    };
    signal.addEventListener('abort', abortHandler);
    removeAbortListener = () => signal.removeEventListener('abort', abortHandler);
  }

  try {
    return await callWithTimeout(
      fetch(input, {
        ...init,
        signal: fetchSignal
      }),
      timeoutMs,
      `Fetch request timed out after ${timeoutMs}ms`,
      operationId
    );
  } catch (error) {
    if (error instanceof TimeoutError) {
      controller.abort();
      throw error;
    }
    
    if (error instanceof Error && (error.name === 'AbortError' || signal?.aborted)) {
      throw new CancellationError('Operation was cancelled', operationId);
    }

    throw error;
  } finally {
    // Clean up abort listener if it was added
    if (removeAbortListener) {
      removeAbortListener();
    }
  }
}

/**
 * Retries an async operation with exponential backoff
 * 
 * @param operation - Async function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelay - Initial delay in milliseconds
 * @param maxDelay - Maximum delay between retries
 * @param operationId - Optional identifier for the operation
 * @returns Promise that resolves with the operation result
 * @throws {Error} When all retry attempts fail
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000,
  operationId?: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        break;
      }

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      );

      logger.debug(
        LogCategory.Retry,
        `Operation failed, retrying`,
        operationId,
        undefined,
        { attempt, maxRetries, delay, error: lastError }
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Operation failed after retries');
} 