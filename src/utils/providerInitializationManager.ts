/**
 * Provider Initialization Manager for MyLera Health Tracking Application
 * 
 * This module provides utilities to safely initialize providers with
 * proper cancellation support, timeout handling, and retry logic.
 */

import { logger, LogCategory } from './logger';

/**
 * Custom error for initialization timeouts
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Custom error for cancellation
 */
export class CancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CancellationError';
  }
}

/**
 * Configuration options for initialization
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
export const DEFAULT_CONFIG: Required<InitializationConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  timeout: 15000,
  operationId: 'init'
};

/**
 * Initializes a provider with timeout and cancellation support
 * 
 * @param initializer Function that performs initialization, accepting an AbortSignal
 * @param timeout Timeout in milliseconds
 * @param operationId Identifier for logging
 * @returns Promise resolving to the initialized provider
 * @throws TimeoutError if initialization times out
 * @throws CancellationError if initialization is cancelled
 */
export async function initializeProviderWithTimeout<T>(
  initializer: (signal: AbortSignal) => Promise<T>,
  timeout: number,
  operationId: string = 'init'
): Promise<T> {
  const controller = new AbortController();
  const { signal } = controller;
  
  logger.debug(
    LogCategory.Provider, 
    `Starting initialization with ${timeout}ms timeout`,
    operationId
  );

  // Create a timeout promise that will reject after the specified timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      const error = new TimeoutError(`Provider initialization timed out after ${timeout}ms`);
      logger.error(
        LogCategory.Timeout, 
        `Initialization timed out after ${timeout}ms`,
        operationId,
        undefined,
        { timeout }
      );
      reject(error);
    }, timeout);

    // Ensure the timeout is cleared if the signal is aborted
    signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
    }, { once: true });
  });

  try {
    // Race the initializer against the timeout
    return await Promise.race([
      initializer(signal),
      timeoutPromise
    ]);
  } catch (error) {
    // Convert AbortError to CancellationError if it wasn't due to timeout
    if (error instanceof Error && error.name === 'AbortError' && !(error instanceof TimeoutError)) {
      logger.warn(
        LogCategory.Provider, 
        `Initialization was cancelled`,
        operationId
      );
      throw new CancellationError('Provider initialization was cancelled');
    }
    throw error;
  }
}

/**
 * Initializes a provider with retry logic, timeout, and cancellation support
 * 
 * @param initializer Function that performs initialization, accepting an AbortSignal
 * @param config Configuration options for retries and timeout
 * @returns Promise resolving to the initialized provider
 * @throws Error if all retry attempts fail
 */
export async function initializeProviderWithRetry<T>(
  initializer: (signal: AbortSignal) => Promise<T>,
  config: Partial<InitializationConfig> = {}
): Promise<T> {
  const { 
    maxRetries, 
    baseDelay, 
    maxDelay, 
    timeout, 
    operationId 
  } = { ...DEFAULT_CONFIG, ...config };

  let lastError: Error | null = null;
  let abortController: AbortController | null = null;

  logger.info(
    LogCategory.Provider, 
    `Initializing provider with retry (max: ${maxRetries})`,
    operationId
  );

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create a new AbortController for this attempt
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();

      logger.debug(
        LogCategory.Provider, 
        `Initialization attempt ${attempt + 1}/${maxRetries + 1}`,
        operationId,
        undefined,
        { attempt: attempt + 1, maxRetries: maxRetries + 1 }
      );

      // Run the initialization with timeout
      const result = await initializeProviderWithTimeout(
        initializer,
        timeout,
        operationId
      );

      logger.info(
        LogCategory.Provider, 
        `Provider initialized successfully on attempt ${attempt + 1}`,
        operationId
      );

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Only retry on timeout or network errors
      const isRetryableError = error instanceof TimeoutError || 
                              (error instanceof Error && 
                               error.message.includes('network'));
      
      if (attempt === maxRetries || !isRetryableError) {
        logger.error(
          LogCategory.Provider, 
          `Provider initialization failed after ${attempt + 1} attempts`,
          operationId,
          undefined,
          { error: lastError, maxRetries, attempt: attempt + 1 }
        );
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      );
      
      logger.debug(
        LogCategory.Provider, 
        `Retrying initialization after ${delay}ms delay`,
        operationId,
        undefined,
        { attempt: attempt + 1, delay, error: lastError.message }
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached due to the throw in the loop
  throw lastError || new Error('Provider initialization failed');
}

/**
 * Safely cleans up a provider, handling any errors that might occur
 * 
 * @param cleanup Function that performs cleanup
 * @param timeout Timeout in milliseconds
 * @param operationId Identifier for logging
 * @returns Promise that resolves when cleanup is complete
 */
export async function safelyCleanupProvider(
  cleanup: () => Promise<void>,
  timeout: number = DEFAULT_CONFIG.timeout,
  operationId: string = 'cleanup'
): Promise<void> {
  logger.debug(
    LogCategory.Provider, 
    `Starting provider cleanup`,
    operationId
  );

  try {
    // Set a timeout for the cleanup operation
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Provider cleanup timed out after ${timeout}ms`));
      }, timeout);
    });

    // Race the cleanup against the timeout
    await Promise.race([cleanup(), timeoutPromise]);
    
    logger.debug(
      LogCategory.Provider, 
      `Provider cleanup completed successfully`,
      operationId
    );
  } catch (error) {
    // Log but don't throw - cleanup failures shouldn't block the application
    logger.warn(
      LogCategory.Provider, 
      `Provider cleanup failed`,
      operationId,
      undefined,
      { error }
    );
  }
}