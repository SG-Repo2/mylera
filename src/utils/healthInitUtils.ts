import { HealthProvider } from '../providers/health/types/provider';
import { HealthProviderError } from '../providers/health/types/errors';
import { HealthProviderFactory } from '../providers/health/factory/HealthProviderFactory';
import { PermissionStatus } from '../providers/health/types/permissions';
import { logger } from './logger';

export interface ProviderInitializationState {
  isInitialized: boolean;
  isInitializing: boolean;
  permissionStatus: PermissionStatus;
  error: Error | null;
}

export type InitializationStateCallback = (state: ProviderInitializationState) => void;
/**
 * Configuration for provider initialization attempts
 */
export interface InitializationConfig {
  maxRetries: number;
  baseDelay: number;  // Base delay in milliseconds
  maxDelay: number;   // Maximum delay in milliseconds
}

const DEFAULT_CONFIG: InitializationConfig = {
  maxRetries: 3,
  baseDelay: 500,   // Start with 500ms delay
  maxDelay: 5000    // Max 5 seconds delay
};

/**
 * Attempts to initialize a health provider with exponential backoff retry logic
 * @param provider The health provider to initialize
 * @param config Optional configuration for retry attempts
 * @returns Promise that resolves when initialization succeeds
 * @throws HealthProviderError if all initialization attempts fail
 */
export async function initializeWithRetry(
  provider: HealthProvider,
  config: InitializationConfig = DEFAULT_CONFIG
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      // Initialize the provider (which now includes permission initialization)
      await provider.initialize();
      
      // Verify initialization was successful
      const permissionManager = provider.getPermissionManager();
      if (!permissionManager) {
        throw new Error('Permission manager not initialized after provider initialization');
      }
      
      // Verify permissions are in a valid state
      const permissionState = await permissionManager.getPermissionState();
      if (!permissionState) {
        throw new Error('Permission state not available after initialization');
      }

      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(
        `[HealthProvider] Initialization attempt ${attempt}/${config.maxRetries} failed:`,
        lastError.message
      );

      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelay * Math.pow(2, attempt - 1),
          config.maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new HealthProviderError(
    `Failed to initialize provider after ${config.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Validates that a provider has been properly initialized
 * @param provider The health provider to validate
 * @throws HealthProviderError if the provider is not properly initialized
 */
export function validateProviderInitialization(provider: HealthProvider): void {
  if (!provider) {
    throw new HealthProviderError('Provider instance is undefined');
  }

  if (typeof provider.initialize !== 'function') {
    throw new HealthProviderError('Provider missing required initialize method');
  }

  if (typeof provider.cleanup !== 'function') {
    throw new HealthProviderError('Provider missing required cleanup method');
  }

  if (typeof provider.getMetrics !== 'function') {
    throw new HealthProviderError('Provider missing required getMetrics method');
  }
}

/**
 * Initializes a health provider for a specific user and manages permission status
 * @param userId The ID of the user to initialize the provider for
 * @param setPermissionStatus Callback to update permission status in the UI
 */
export async function initializeHealthProviderForUser(
  userId: string,
  setPermissionStatus: (status: PermissionStatus) => void,
  updateState: InitializationStateCallback
): Promise<void> {
  const operationId = Date.now();
  logger.info('health', 'Starting provider initialization', operationId.toString(), userId);

  updateState({
    isInitialized: false,
    isInitializing: true,
    permissionStatus: 'not_determined',
    error: null
  });

  try {
    // Step 1: Get provider instance
    const provider = await HealthProviderFactory.getProvider(undefined, userId);
    logger.debug('health', 'Provider instance obtained',  operationId.toString(), userId);
    validateProviderInitialization(provider);

    // Step 2: Initialize provider with retry (now includes permission initialization)
    try {
      await initializeWithRetry(provider);
      logger.info('health', 'Provider initialized successfully', operationId.toString(), userId);
    } catch (error) {
      logger.error('health', 'Provider initialization failed', operationId.toString(), userId, error);
      updateState({
        isInitializing: false,
        isInitialized: false,
        permissionStatus: 'denied',
        error: error instanceof Error ? error : new Error('Provider initialization failed')
      });
      throw error;
    }

    // Step 3: Verify permission state after initialization
    const permissionManager = provider.getPermissionManager();
    if (!permissionManager) {
      throw new Error('Permission manager not available after initialization');
    }

    const permissionState = await permissionManager.getPermissionState();
    if (!permissionState) {
      throw new Error('Permission state not available after initialization');
    }

    // Update states based on verification results
    setPermissionStatus(permissionState.status);
    updateState({
      isInitialized: permissionState.status === 'granted',
      isInitializing: false,
      permissionStatus: permissionState.status,
      error: null
    });

    if (permissionState.status !== 'granted') {
      logger.warn('health', 'Health permissions not granted after initialization', operationId.toString(), userId);
    } else {
      logger.info('health', 'Health provider fully initialized with permissions', operationId.toString(), userId);
    }

  } catch (error) {
    logger.error('health', 'Fatal error during provider initialization', operationId.toString(), userId, error);
    setPermissionStatus('denied');
    updateState({
      isInitialized: false,
      isInitializing: false,
      permissionStatus: 'denied',
      error: error instanceof Error ? error : new Error('Provider initialization failed')
    });
    throw error;
  }
}

export async function safeProviderCleanup(provider: HealthProvider): Promise<void> {
  if (!provider) {
    return;
  }

  try {
    await provider.cleanup();
  } catch (error) {
    console.error(
      '[HealthProvider] Error during provider cleanup:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
