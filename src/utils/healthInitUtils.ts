import { HealthProviderFactory } from '../providers/health/factory/HealthProviderFactory';
import type { PermissionStatus } from '../providers/health/types/permissions';
import { mapAuthError } from './errorUtils';
import { supabase } from '../services/supabaseClient';

const MAX_INIT_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Delay utility for retry mechanism
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Add a cache to prevent duplicate initializations
const initializedUsers = new Map<string, boolean>();

// Add a lock to prevent parallel initializations of the same user
const initializationLocks = new Map<string, boolean>();

/**
 * Initialize health provider for a given user and update permission status
 * Includes retry logic and enhanced error handling
 */
export async function initializeHealthProviderForUser(
  userId: string,
  setHealthStatus: (status: PermissionStatus) => void
): Promise<void> {
  // Check if this user is already initialized
  if (initializedUsers.get(userId)) {
    console.log(`[HealthInit] Provider already initialized for user ${userId}, using cached instance`);
    // Still return the cached permission status but don't trigger full re-initialization
    try {
      const provider = HealthProviderFactory.getProvider();
      const permissionState = await provider.checkPermissionsStatus();
      // Update status without triggering downstream re-renders
      requestAnimationFrame(() => {
        setHealthStatus(permissionState.status);
      });
    } catch (err) {
      console.warn(`[HealthInit] Error getting cached status:`, err);
    }
    return;
  }
  
  // Check if this user is currently being initialized
  if (initializationLocks.get(userId)) {
    console.log(`[HealthInit] Provider initialization already in progress for user ${userId}, waiting`);
    // Wait for the existing initialization to complete
    let attempts = 0;
    while (initializationLocks.get(userId) && attempts < 10) {
      await delay(300);
      attempts++;
    }
    
    // After waiting, if we're still locked, throw an error to prevent deadlock
    if (initializationLocks.get(userId)) {
      console.error(`[HealthInit] Initialization lock timeout for user ${userId}`);
      throw new Error('Health provider initialization timeout');
    }
    
    // If initialization completed while waiting, return the cached instance
    if (initializedUsers.get(userId)) {
      return;
    }
  }
  
  // Acquire lock
  initializationLocks.set(userId, true);
  
  let retries = 0;
  let lastError: Error | null = null;
  
  try {
    console.log(`[HealthInit] Starting provider initialization for user ${userId}`);
    
    while (retries < 3) {
      try {
        const provider = HealthProviderFactory.getProvider();
        
        // First check if the provider is already initialized to avoid redundant work
        try {
          const existingState = await provider.checkPermissionsStatus();
          const status = typeof existingState === 'string' 
            ? existingState 
            : existingState.status;
            
          // Safely handle the status as string first
          const statusStr = String(status);
          const validStatus = (statusStr === 'prompt' ? 'not_determined' : statusStr) as PermissionStatus;
          
          if (validStatus && validStatus !== 'not_determined') {
            console.log(`[HealthInit] Provider already initialized with status: ${validStatus}`);
            setHealthStatus(validStatus);
            initializedUsers.set(userId, true);
            return;
          }
        } catch (checkError) {
          // Ignore check errors and proceed with initialization
          console.log(`[HealthInit] Could not check existing status, initializing: ${checkError}`);
        }
        
        await provider.initializeWithPermissions(userId);
        
        // Check the permission state after initialization
        const permissionState = await provider.checkPermissionsStatus();
        const status = typeof permissionState === 'string'
          ? permissionState
          : permissionState.status;
          
        // Safely handle the status as string first
        const statusStr = String(status);
        const validStatus = (statusStr === 'prompt' ? 'not_determined' : statusStr) as PermissionStatus;
        
        console.log(`[HealthInit] Initialization successful, permission status: ${validStatus}`);
        
        setHealthStatus(validStatus);
        initializedUsers.set(userId, true);
        return;
      } catch (providerError) {
        console.log(`[HealthInit] Provider initialization failed on attempt ${retries + 1}:`, providerError);
        lastError = providerError instanceof Error ? providerError : new Error(String(providerError));
        retries++;
        
        if (retries < 3) {
          const backoffDelay = 1000 * Math.pow(2, retries - 1);
          console.log(`[HealthInit] Retrying in ${backoffDelay}ms`);
          await delay(backoffDelay);
        }
      }
    }
    
    throw lastError || new Error(`Unknown error initializing health provider for user ${userId}`);
  } finally {
    // Always release the lock whether initialization succeeded or failed
    initializationLocks.set(userId, false);
  }
}
