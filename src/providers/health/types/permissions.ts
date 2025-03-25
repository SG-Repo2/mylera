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
const PERMISSION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export const getPermissionCacheKey = (userId: string): string => 
  `${PERMISSION_CACHE_KEY}:${userId}:${Platform.OS}`;

export async function cachePermissionState(
  userId: string,
  state: PermissionState
): Promise<void> {
  try {
    const key = getPermissionCacheKey(userId);
    await AsyncStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.error('Error caching permission state:', error);
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

export async function forcePermissionVerification(userId: string): Promise<void> {
  // Always clear cached permissions on app restart/reinstall
  await clearPermissionCache(userId);
}

export function isPermissionSecurityException(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || String(error);
    
  return errorMessage.toLowerCase().includes('security') || 
         errorMessage.toLowerCase().includes('permission') ||
         errorMessage.toLowerCase().includes('READ_') ||
         errorMessage.toLowerCase().includes('denied access');
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
    const state: PermissionState = {
      status,
      lastChecked: Date.now(),
      deniedPermissions
    };
    await cachePermissionState(this.userId, state);
  }

  async clearCache(): Promise<void> {
    await clearPermissionCache(this.userId);
  }

  async handlePermissionError(permission: string, error: any): Promise<never> {
    await this.updatePermissionState('denied', [permission]);
    throw new HealthProviderPermissionError(permission, error?.message);
  }
}