import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { logger, LogCategory } from '../../../utils/logger';
import { callWithTimeout, DEFAULT_TIMEOUTS } from '../../../utils/asyncUtils';
import { HealthProviderPermissionError } from './errors';

export type PermissionStatus = 'granted' | 'denied' | 'not_determined' | 'limited' | 'provisional';

export interface PermissionState {
  status: PermissionStatus;
  lastChecked: number;
  deniedPermissions?: string[];
}

const PERMISSION_CACHE_KEY = '@health_permissions';
const PERMISSION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class PermissionManager {
  private userId: string;
  private platform: string;
  private currentState: PermissionState | null = null;
  private stateTransitionTimeout: number = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(userId: string) {
    this.userId = userId;
    this.platform = Platform.OS;
  }

  private getCacheKey(): string {
    return `${PERMISSION_CACHE_KEY}:${this.userId}:${this.platform}`;
  }

  async getPermissionState(): Promise<PermissionState | null> {
    try {
      if (this.currentState) {
        return this.currentState;
      }

      const state = await callWithTimeout(
        this.loadFromCache(),
        DEFAULT_TIMEOUTS.PERMISSION,
        'Permission state load timed out'
      );

      if (!state || this.isStateExpired(state)) {
        return null;
      }

      this.currentState = state;
      return state;
    } catch (error) {
      logger.error(
        LogCategory.Health,
        'Error getting permission state',
        this.userId,
        undefined,
        { error }
      );
      return null;
    }
  }

  async updatePermissionState(
    newStatus: PermissionStatus,
    deniedPermissions?: string[]
  ): Promise<void> {
    const currentState = await this.getPermissionState();
    
    try {
      const newState: PermissionState = {
        status: newStatus,
        lastChecked: Date.now(),
        deniedPermissions: deniedPermissions || currentState?.deniedPermissions
      };

      await callWithTimeout(
        this.saveToCache(newState),
        DEFAULT_TIMEOUTS.PERMISSION,
        'Permission state update timed out'
      );

      this.currentState = newState;
      
      logger.info(
        LogCategory.Health,
        'Permission state updated',
        this.userId,
        undefined,
        { oldStatus: currentState?.status, newStatus }
      );
    } catch (error) {
      logger.error(
        LogCategory.Health,
        'Failed to update permission state',
        this.userId,
        undefined,
        { error, currentState, newStatus }
      );
      throw new HealthProviderPermissionError(
        'state_update',
        'Failed to update permission state'
      );
    }
  }

  async handlePermissionDenial(permission: string): Promise<void> {
    const currentState = await this.getPermissionState();
    const deniedPermissions = new Set(currentState?.deniedPermissions || []);
    deniedPermissions.add(permission);

    await this.updatePermissionState('denied', Array.from(deniedPermissions));
  }

  async handlePermissionError(
    permission: string,
    error: unknown
  ): Promise<void> {
    logger.error(
      LogCategory.Health,
      'Permission error encountered',
      this.userId,
      undefined,
      { permission, error }
    );

    try {
      // If the error indicates a clear denial, mark as denied
      if (this.isDenialError(error)) {
        await this.handlePermissionDenial(permission);
      } else {
        // For other errors, mark as not_determined to allow retrying
        await this.updatePermissionState('not_determined');
      }
    } catch (handlingError) {
      logger.error(
        LogCategory.Health,
        'Failed to handle permission error',
        this.userId,
        undefined,
        { permission, originalError: error, handlingError }
      );
      throw new HealthProviderPermissionError(
        permission,
        'Failed to handle permission error'
      );
    }
  }

  private isDenialError(error: unknown): boolean {
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      return (
        errorMessage.includes('denied') ||
        errorMessage.includes('rejected') ||
        errorMessage.includes('permission') ||
        errorMessage.includes('not authorized')
      );
    }
    return false;
  }

  async clearCache(): Promise<void> {
    try {
      await callWithTimeout(
        AsyncStorage.removeItem(this.getCacheKey()),
        DEFAULT_TIMEOUTS.PERMISSION,
        'Permission cache clear timed out'
      );
      this.currentState = null;
    } catch (error) {
      logger.error(
        LogCategory.Health,
        'Failed to clear permission cache',
        this.userId,
        undefined,
        { error }
      );
      throw error;
    }
  }

  private async loadFromCache(): Promise<PermissionState | null> {
    try {
      const cached = await AsyncStorage.getItem(this.getCacheKey());
      if (!cached) return null;

      const state = JSON.parse(cached) as PermissionState;
      if (!this.isValidState(state)) {
        await this.clearCache();
        return null;
      }

      return state;
    } catch (error) {
      logger.error(
        LogCategory.Health,
        'Error loading permission cache',
        this.userId,
        undefined,
        { error }
      );
      return null;
    }
  }

  private async saveToCache(state: PermissionState): Promise<void> {
    if (!this.isValidState(state)) {
      throw new Error('Invalid permission state');
    }

    await AsyncStorage.setItem(
      this.getCacheKey(),
      JSON.stringify(state)
    );
  }

  private isStateExpired(state: PermissionState): boolean {
    const age = Date.now() - state.lastChecked;
    return age > PERMISSION_CACHE_TTL;
  }

  private isValidState(state: any): state is PermissionState {
    return (
      state &&
      typeof state === 'object' &&
      typeof state.status === 'string' &&
      ['granted', 'denied', 'not_determined', 'limited', 'provisional'].includes(state.status) &&
      typeof state.lastChecked === 'number' &&
      (!state.deniedPermissions || Array.isArray(state.deniedPermissions))
    );
  }

  shouldUpgradeProvisional(): boolean {
    if (!this.currentState || this.currentState.status !== 'provisional') {
      return false;
    }
    return Date.now() - this.currentState.lastChecked >= this.stateTransitionTimeout;
  }
}
