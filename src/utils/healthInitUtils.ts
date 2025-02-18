import { HealthProvider } from '../providers/health/types/provider';
import { HealthProviderError } from '../providers/health/types/errors';
import { HealthProviderFactory } from '../providers/health/factory/HealthProviderFactory';
import { PermissionStatus } from '../providers/health/types/permissions';
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
  try {
    const provider = await HealthProviderFactory.getProvider();
    
    // Initialize permissions for the user
    await provider.initializePermissions(userId);
    
    // Check current permission status
    const permissionState = await provider.checkPermissionsStatus();
    setPermissionStatus(permissionState.status);
    
    // Initialize the provider if permissions are granted
    if (permissionState.status === 'granted') {
      await initializeWithRetry(provider);
    }
  } catch (error) {
    console.error(
      '[HealthProvider] Error initializing provider for user:',
      error instanceof Error ? error.message : 'Unknown error'
    );
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
