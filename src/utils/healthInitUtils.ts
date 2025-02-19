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
  const initId = Date.now();
  console.log(`[HealthProvider] [${initId}] Starting provider initialization for user:`, userId);

  try {
    // Step 1: Get or create provider instance
    console.log(`[HealthProvider] [${initId}] Retrieving provider instance`);
    const provider = await HealthProviderFactory.getProvider(undefined, userId);
    
    // Step 2: Initialize provider if needed
    try {
      console.log(`[HealthProvider] [${initId}] Checking provider initialization status`);
      await initializeWithRetry(provider, {
        maxRetries: 3,
        baseDelay: 500,
        maxDelay: 5000
      });
      console.log(`[HealthProvider] [${initId}] Provider initialized successfully`);
    } catch (error) {
      console.error(`[HealthProvider] [${initId}] Provider initialization failed:`, error);
      throw new HealthProviderError(
        `Provider initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Step 3: Initialize permissions with retry logic
    let permissionInitSuccess = false;
    let permissionInitAttempt = 0;
    const maxPermissionRetries = 2;

    while (!permissionInitSuccess && permissionInitAttempt < maxPermissionRetries) {
      permissionInitAttempt++;
      try {
        console.log(`[HealthProvider] [${initId}] Initializing permissions (attempt ${permissionInitAttempt})`);
        await provider.initializePermissions(userId);
        permissionInitSuccess = true;
        console.log(`[HealthProvider] [${initId}] Permissions initialized successfully`);
      } catch (error) {
        console.error(
          `[HealthProvider] [${initId}] Permission initialization attempt ${permissionInitAttempt} failed:`,
          error
        );
        
        if (permissionInitAttempt < maxPermissionRetries) {
          console.log(`[HealthProvider] [${initId}] Retrying permission initialization...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        } else {
          throw new HealthProviderError(
            `Failed to initialize permissions after ${maxPermissionRetries} attempts`
          );
        }
      }
    }

    // Step 4: Check and update permission status
    try {
      console.log(`[HealthProvider] [${initId}] Checking current permission status`);
      const permissionState = await provider.checkPermissionsStatus();
      console.log(`[HealthProvider] [${initId}] Permission status:`, permissionState.status);
      
      setPermissionStatus(permissionState.status);
      
      if (permissionState.status === 'granted') {
        console.log(`[HealthProvider] [${initId}] Permissions granted, provider ready`);
      } else {
        console.warn(
          `[HealthProvider] [${initId}] Permissions not granted:`,
          permissionState.status
        );
      }
    } catch (error) {
      console.error(`[HealthProvider] [${initId}] Error checking permission status:`, error);
      setPermissionStatus('denied');
      throw new HealthProviderError(
        `Failed to check permission status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

  } catch (error) {
    console.error(
      `[HealthProvider] [${initId}] Fatal error during provider initialization:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
    setPermissionStatus('denied');
    throw error;
  } finally {
    console.log(`[HealthProvider] [${initId}] Provider initialization process completed`);
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
