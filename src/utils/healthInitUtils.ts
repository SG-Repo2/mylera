import { HealthProvider } from '../providers/health/types/provider';
import { HealthProviderError } from '../providers/health/types/errors';
import { HealthProviderFactory } from '../providers/health/factory/HealthProviderFactory';
import { PermissionStatus } from '../providers/health/types/permissions';
import { logger } from './logger';
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
      await provider.initialize();
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(
        `[HealthProvider] Initialization attempt ${attempt}/${config.maxRetries} failed:`,
        lastError.message
      );

      if (attempt < config.maxRetries) {
        // Calculate delay with exponential backoff
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
  setPermissionStatus: (status: PermissionStatus) => void
): Promise<void> {
  const operationId = Date.now().toString();
  logger.info('health', 'Starting provider initialization', operationId, userId);

  try {
    const provider = await HealthProviderFactory.getProvider(undefined, userId);
    logger.debug('health', 'Provider instance obtained', operationId, userId);

    try {
      await initializeWithRetry(provider);
      logger.info('health', 'Provider initialized successfully', operationId, userId);
    } catch (error) {
      logger.error('health', 'Provider initialization failed', operationId, userId, error);
      throw error;
    }

    let permissionInitSuccess = false;
    let permissionInitAttempt = 0;
    const maxPermissionRetries = 2;

    while (!permissionInitSuccess && permissionInitAttempt < maxPermissionRetries) {
      permissionInitAttempt++;
      try {
        logger.debug('health', `Initializing permissions (attempt ${permissionInitAttempt})`, operationId, userId);
        await provider.initializePermissions(userId);
        permissionInitSuccess = true;
        logger.info('health', 'Permissions initialized successfully', operationId, userId);
      } catch (error) {
        logger.warn('health', `Permission initialization attempt ${permissionInitAttempt} failed`, operationId, userId, error);
        if (permissionInitAttempt >= maxPermissionRetries) {
          throw error;
        }
      }
    }

    // Step 4: Check and update permission status
    try {
      console.log(`[HealthProvider] [${operationId}] Checking current permission status`);
      const permissionState = await provider.checkPermissionsStatus();
      console.log(`[HealthProvider] [${operationId}] Permission status:`, permissionState.status);
      
      setPermissionStatus(permissionState.status);
      
      if (permissionState.status === 'granted') {
        console.log(`[HealthProvider] [${operationId}] Permissions granted, provider ready`);
      } else {
        console.warn(
          `[HealthProvider] [${operationId}] Permissions not granted:`,
          permissionState.status
        );
      }
    } catch (error) {
      console.error(`[HealthProvider] [${operationId}] Error checking permission status:`, error);
      setPermissionStatus('denied');
      throw new HealthProviderError(
        `Failed to check permission status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

  } catch (error) {
    logger.error('health', 'Fatal error during provider initialization', operationId, userId, error);
    setPermissionStatus('denied');
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
