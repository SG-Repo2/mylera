import { HealthProviderFactory } from '../providers/health/factory/HealthProviderFactory';
import type { PermissionStatus } from '../providers/health/types/permissions';
import { logger, LogCategory } from './logger';

/**
 * Delay utility for retry mechanism
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Track initialized users to prevent redundant initializations
const initializedUsers = new Set<string>();

// Constants for initialization
const INIT_TIMEOUT = 8000; // 8 seconds timeout
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

/**
 * Initialize health provider for a given user and update permission status
 * Uses the unified safeInitialize method from the provider with improved error handling
 */
export async function initializeHealthProviderForUser(
  userId: string,
  setHealthStatus: (status: PermissionStatus) => void
): Promise<void> {
  try {
    // Check if this user is already initialized
    if (initializedUsers.has(userId)) {
      logger.info(LogCategory.Health, `Provider already initialized for user ${userId}`);

      // Just update the status from the current state
      const provider = HealthProviderFactory.getProvider();
      const status = await provider.checkPermissionsStatus();
      const finalStatus = typeof status === 'string' ? status : status.status;

      setHealthStatus(finalStatus);
      return;
    }

    logger.info(LogCategory.Health, `Initializing provider for user ${userId}`);

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health provider initialization timeout')), INIT_TIMEOUT);
    });

    // Initialize with retries
    const initializeWithRetries = async () => {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const provider = HealthProviderFactory.getProvider();
          const permissionStatus = await provider.safeInitialize(userId);

          logger.info(
            LogCategory.Health,
            `Provider initialized successfully on attempt ${attempt + 1}`
          );
          return permissionStatus;
        } catch (error) {
          if (attempt === MAX_RETRIES) throw error;

          logger.warn(
            LogCategory.Health,
            `Initialization attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY}ms`
          );

          await delay(RETRY_DELAY);
        }
      }
      throw new Error('All initialization attempts failed');
    };

    // Race between initialization and timeout
    const permissionStatus = await Promise.race([initializeWithRetries(), timeoutPromise]);

    // Update status and mark as initialized
    setHealthStatus(permissionStatus);
    initializedUsers.add(userId);

    logger.info(LogCategory.Health, `Provider initialization complete for user ${userId}`);
  } catch (error) {
    // Detailed error logging
    logger.error(
      LogCategory.Health,
      `Health provider initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error.stack : undefined
    );

    // Always provide a fallback status
    setHealthStatus('not_determined');

    // Still mark as initialized to prevent further attempts
    initializedUsers.add(userId);

    // Log the fallback action
    logger.info(
      LogCategory.Health,
      `Fallback status set for user ${userId} after initialization failure`
    );
  }
}
