import { logger, LogCategory } from '@/src/utils/logger';

/**
 * Retry an operation with exponential backoff
 * @param operation Function to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param initialDelay Initial delay in ms (default: 1000)
 * @returns Result of the operation
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(
          LogCategory.Health,
          `[GoogleHealthProvider] Retry attempt ${attempt}/${maxRetries}`
        );
      }
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isNetworkError =
        lastError.message.includes('Network') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('connection') ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ECONNRESET');

      // Only retry if it's a network error
      if (!isNetworkError || attempt === maxRetries) {
        logger.error(
          LogCategory.Health,
          `[GoogleHealthProvider] Operation failed after ${attempt + 1} attempts:`,
          lastError.message
        );
        throw lastError;
      }

      const delay = initialDelay * Math.pow(2, attempt);
      logger.info(
        LogCategory.Health,
        `[GoogleHealthProvider] Operation failed, retrying in ${delay}ms...`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached due to the throw in the catch block
  throw lastError || new Error('Operation failed after retries');
}
