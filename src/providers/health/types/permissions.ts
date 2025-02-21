import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HealthProviderPermissionError } from './errors';

export type PermissionStatus = 'granted' | 'denied' | 'not_determined' | 'limited' | 'provisional';

export interface PermissionState {
  status: PermissionStatus;
  lastChecked: number;
  deniedPermissions?: string[];
}

const PERMISSION_CACHE_KEY = '@health_permissions';
const PERMISSION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const getPermissionCacheKey = (userId: string): string => 
  `${PERMISSION_CACHE_KEY}:${userId}:${Platform.OS}`;

export async function cachePermissionState(
  userId: string,
  state: PermissionState
): Promise<void> {
  const key = getPermissionCacheKey(userId);
  
  try {
    // First get the current state to ensure atomic update
    const currentStateStr = await AsyncStorage.getItem(key);
    const currentState = currentStateStr ? JSON.parse(currentStateStr) : null;
    
    // Merge with current state if it exists
    const newState: PermissionState = {
      ...currentState,
      ...state,
      lastChecked: Date.now(),
    };

    // Validate state before saving
    if (typeof newState.status !== 'string' || 
        !['granted', 'denied', 'not_determined', 'limited', 'provisional'].includes(newState.status)) {
      throw new Error('Invalid permission status');
    }

    await AsyncStorage.setItem(key, JSON.stringify(newState));
  } catch (error) {
    console.error('Error caching permission state:', error);
    throw new Error(`Failed to update permission state: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getCachedPermissionState(
  userId: string
): Promise<PermissionState | null> {
  try {
    const key = getPermissionCacheKey(userId);
    const cached = await AsyncStorage.getItem(key);
    
    if (!cached) return null;
    
    const state: PermissionState = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired
    if (now - state.lastChecked > PERMISSION_CACHE_TTL) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    
    return state;
  } catch (error) {
    console.error('Error getting cached permission state:', error);
    return null;
  }
}

export async function clearPermissionCache(userId: string): Promise<void> {
  try {
    const key = getPermissionCacheKey(userId);
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing permission cache:', error);
  }
}

export class PermissionManager {
  private userId: string;
  private stateTransitionTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(userId: string) {
    this.userId = userId;
  }

  async getPermissionState(): Promise<PermissionState | null> {
    return getCachedPermissionState(this.userId);
  }

  async updatePermissionState(status: PermissionStatus, deniedPermissions?: string[]): Promise<void> {
    // Create a backup of the current state before updating
    const currentState = await this.getPermissionState();
    
    try {
      const state: PermissionState = {
        status,
        lastChecked: Date.now(),
        deniedPermissions: deniedPermissions || currentState?.deniedPermissions
      };
      
      // Handle state transitions
      if (currentState?.status !== status) {
        console.log(`[PermissionManager] State transition: ${currentState?.status} -> ${status}`);
        
        // Handle specific transitions
        if (status === 'limited' && currentState?.status === 'granted') {
          console.warn('[PermissionManager] Permission downgraded from granted to limited');
        } else if (status === 'provisional' && this.shouldUpgradeProvisional(currentState)) {
          console.log('[PermissionManager] Attempting to upgrade provisional permissions');
          return; // Let the caller handle the upgrade
        }
      }
      
      await cachePermissionState(this.userId, state);
    } catch (error) {
      // If update fails, try to restore previous state
      if (currentState) {
        try {
          await cachePermissionState(this.userId, currentState);
        } catch (restoreError) {
          console.error('[PermissionManager] Failed to restore permission state:', restoreError);
        }
      }
      throw error;
    }
  }

  private shouldUpgradeProvisional(currentState: PermissionState | null): boolean {
    if (!currentState || currentState.status !== 'provisional') {
      return false;
    }
    
    // Check if enough time has passed since the last check
    const timeSinceLastCheck = Date.now() - currentState.lastChecked;
    return timeSinceLastCheck >= this.stateTransitionTimeout;
  }

  async handlePermissionDenial(): Promise<void> {
    const currentState = await this.getPermissionState();
    
    // If transitioning from limited/provisional to denied, perform cleanup
    if (currentState?.status === 'limited' || currentState?.status === 'provisional') {
      console.log('[PermissionManager] Cleaning up after permission denial');
      await this.clearCache();
    }
    
    await this.updatePermissionState('denied');
  }

  async handlePermissionError(permission: string, error: any): Promise<never> {
    console.error('[PermissionManager] Permission error:', {
      permission,
      error,
      currentState: await this.getPermissionState()
    });
    
    await this.handlePermissionDenial();
    throw new HealthProviderPermissionError(permission, error?.message);
  }

  async clearCache(): Promise<void> {
    try {
      await clearPermissionCache(this.userId);
      console.log('[PermissionManager] Permission cache cleared successfully');
    } catch (error) {
      console.error('[PermissionManager] Error clearing permission cache:', error);
      throw error;
    }
  }
}
