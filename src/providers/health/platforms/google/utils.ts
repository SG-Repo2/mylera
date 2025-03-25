import { logger, LogCategory } from '@/src/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Storage keys for permission management
const INSTALLATION_ID_KEY = '@health_connect_installation_id';
const PERMISSION_STATE_KEY = '@health_connect_permission_state';
const PERMISSION_VERIFIED_KEY = '@health_connect_permission_verified';

/**
 * Checks if the app has been reinstalled by comparing installation IDs
 * @returns true if this is a new installation
 */
export async function checkAndUpdateInstallationId(): Promise<boolean> {
  try {
    // Generate a new installation ID
    const newInstallationId = Date.now().toString();
    
    // Get the previous installation ID (if any)
    const previousId = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
    
    // If no previous ID or different ID, this is a new installation
    const isNewInstallation = !previousId || previousId !== newInstallationId;
    
    if (isNewInstallation) {
      logger.info(LogCategory.Health, 
        `[GoogleHealthProvider] New installation detected. Previous: ${previousId || 'none'}, New: ${newInstallationId}`
      );
      
      // Save the new installation ID
      await AsyncStorage.setItem(INSTALLATION_ID_KEY, newInstallationId);
      
      // Clear permission state on new installation
      await clearPermissionState();
    }
    
    return isNewInstallation;
  } catch (error) {
    logger.error(LogCategory.Health, 
      '[GoogleHealthProvider] Error checking installation ID:', 
      error instanceof Error ? error.message : 'Unknown error'
    );
    return false;
  }
}

/**
 * Clears all stored permission state data
 */
export async function clearPermissionState(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(PERMISSION_STATE_KEY),
      AsyncStorage.removeItem(PERMISSION_VERIFIED_KEY)
    ]);
    logger.info(LogCategory.Health, '[GoogleHealthProvider] Permission state cleared');
  } catch (error) {
    logger.error(LogCategory.Health, 
      '[GoogleHealthProvider] Error clearing permission state:', 
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Stores the result of permission verification
 */
export async function setPermissionVerified(isVerified: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSION_VERIFIED_KEY, String(isVerified));
  } catch (error) {
    logger.error(LogCategory.Health, 
      '[GoogleHealthProvider] Error storing permission verification:', 
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Gets the stored permission verification status
 */
export async function getPermissionVerified(): Promise<boolean | null> {
  try {
    const value = await AsyncStorage.getItem(PERMISSION_VERIFIED_KEY);
    return value === null ? null : value === 'true';
  } catch (error) {
    logger.error(LogCategory.Health, 
      '[GoogleHealthProvider] Error getting permission verification:', 
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

/**
 * Checks if the error is a permission or security exception
 */
export function isSecurityOrPermissionError(error: unknown): boolean {
  if (!error) return false;
  
  const errorMessage = error instanceof Error 
    ? error.message 
    : String(error);
    
  return (
    errorMessage.includes('Permission') ||
    errorMessage.includes('permission') ||
    errorMessage.includes('SECURITY_EXCEPTION') ||
    errorMessage.includes('SecurityException') ||
    errorMessage.includes('access denied') ||
    errorMessage.includes('not granted') ||
    errorMessage.includes('not authorized')
  );
}