import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HealthProviderPermissionError } from './errors';

export type PermissionStatus = 'granted' | 'denied' | 'not_determined';

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
        !['granted', 'denied', 'not_determined'].includes(newState.status)) {
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
      
      await cachePermissionState(this.userId, state);
    } catch (error) {
      // If update fails, try to restore previous state
      if (currentState) {
        try {
          await cachePermissionState(this.userId, currentState);
        } catch (restoreError) {
          console.error('Failed to restore permission state:', restoreError);
        }
      }
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    await clearPermissionCache(this.userId);
  }

  async handlePermissionError(permission: string, error: any): Promise<never> {
    await this.updatePermissionState('denied', [permission]);
    throw new HealthProviderPermissionError(permission, error?.message);
  }
}
