import { logger, LogCategory } from './logger';
import { callWithTimeout, DEFAULT_TIMEOUTS, TimeoutError } from './asyncUtils';
import type { HealthProvider } from '../providers/health/types/provider';
import { HealthProviderInitializationError } from '../providers/health/types/errors';

/**
 * Configuration options for provider initialization
 */
export interface InitializationConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  timeout?: number;
  operationId?: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<InitializationConfig> = {
  maxRetries: 2,
  baseDelay: 1000,
  maxDelay: 5000,
  timeout: DEFAULT_TIMEOUTS.INITIALIZATION,
  operationId: 'provider-init'
};

/**
 * Initializes a health provider with retry logic and timeout handling
 * 
 * @param provider - The health provider to initialize
 * @param config - Optional configuration for initialization behavior
 * @returns Promise that resolves when initialization succeeds
 * @throws {HealthProviderInitializationError} When initialization fails after all retries
 */
export async function initializeProviderWithRetry(
  provider: HealthProvider,
  config: InitializationConfig = {}
): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { maxRetries, baseDelay, maxDelay, timeout, operationId } = finalConfig;

  let lastError: Error | null = null;
  const controller = new AbortController();
  const { signal } = controller;

  // Set timeout
  const timeoutId = setTimeout(() => {
    controller.abort('timeout');
  }, timeout);

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(
          LogCategory.Health,
          `Attempting provider initialization`,
          operationId,
          undefined,
          { attempt, maxRetries }
        );

        // Verify userId is set before initialization
        if (!provider.getUserId()) {
          throw new Error('Provider userId must be set before initialization');
        }

        // Initialize with abort signal
        await Promise.race([
          provider.initialize(),
          new Promise((_, reject) => {
            signal.addEventListener('abort', () => {
              reject(new TimeoutError('Provider initialization timed out'));
            });
          })
        ]);

        logger.info(
          LogCategory.Health,
          'Provider initialized successfully',
          operationId,
          undefined,
          { attempt }
        );

        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // If userId is not set or initialization was aborted, don't retry
        if (lastError.message.includes('userId must be set') || 
            signal.aborted) {
          break;
        }
        
        const errorType = error instanceof TimeoutError ? 'timeout' : 'unknown';
        
        logger.warn(
          LogCategory.Health,
          'Provider initialization failed',
          operationId,
          undefined,
          { attempt, error: lastError, errorType }
        );

        if (attempt === maxRetries) {
          break;
        }

        // Skip retry delay if it was a timeout error
        if (!(error instanceof TimeoutError)) {
          const delay = Math.min(
            baseDelay * Math.pow(2, attempt),
            maxDelay
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Clean up on final failure
    await cleanupProvider(provider, operationId);

    const errorType = lastError instanceof TimeoutError ? 'timeout' : 'unknown';
    throw new HealthProviderInitializationError(
      errorType,
      `Failed after ${maxRetries + 1} attempts: ${lastError?.message}`
    );
  } finally {
    clearTimeout(timeoutId);
    controller.abort(); // Ensure any pending operations are cancelled
  }
}

/**
 * Helper function to cleanup provider with timeout
 */
async function cleanupProvider(
  provider: HealthProvider, 
  operationId: string
): Promise<void> {
  try {
    await callWithTimeout(
      provider.cleanup(),
      DEFAULT_TIMEOUTS.CLEANUP,
      'Provider cleanup timed out',
      operationId
    );
  } catch (cleanupError) {
    logger.error(
      LogCategory.Health,
      'Provider cleanup failed after initialization failure',
      operationId,
      undefined,
      { cleanupError }
    );
  }
}