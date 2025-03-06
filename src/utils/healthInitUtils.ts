import { HealthProviderFactory } from '../providers/health/factory/HealthProviderFactory';
import type { PermissionStatus } from '../providers/health/types/permissions';
import { logger, LogCategory } from './logger';

/**
 * Delay utility for retry mechanism
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Track initialized users to prevent redundant initializations
const initializedUsers = new Set<string>();

/**
 * Initialize health provider for a given user and update permission status
 * Uses the unified safeInitialize method from the provider
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
    
    // Get provider and use the unified safeInitialize method
    const provider = HealthProviderFactory.getProvider();
    const permissionStatus = await provider.safeInitialize(userId);
    
    logger.info(LogCategory.Health, `Provider initialization complete, status: ${permissionStatus}`);
    
    // Update the status
    setHealthStatus(permissionStatus);
    
    // Mark this user as initialized
    initializedUsers.add(userId);
    
  } catch (error) {
    logger.error(LogCategory.Health, `Failed to initialize health provider: ${error}`);
    
    // Default to 'not_determined' status on error
    setHealthStatus('not_determined');
  }
}
