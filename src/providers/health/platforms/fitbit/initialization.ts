import * as SecureStore from 'expo-secure-store';
import { logger, LogCategory } from '@/src/utils/logger';
import { STORAGE_KEYS } from './utils';
import { supabase } from '../../../../services/supabaseClient';
import { FitbitProviderState } from './types';

export async function initializeFitbitProvider(): Promise<FitbitProviderState> {
  try {
    logger.info(LogCategory.Health, '[FitbitHealthProvider] Initializing...');

    // Load stored tokens
    const accessToken = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    const expiryStr = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN_EXPIRY);
    const tokenExpiresAt = expiryStr ? parseInt(expiryStr, 10) : null;

    // Set last sync time from storage
    let lastSyncTime: Date | null = null;
    const lastSyncStr = await SecureStore.getItemAsync(STORAGE_KEYS.LAST_SYNC);
    if (lastSyncStr) {
      lastSyncTime = new Date(parseInt(lastSyncStr, 10));
    }

    // Check token expiry with 5-minute buffer
    if (accessToken && tokenExpiresAt && Date.now() >= tokenExpiresAt - 5 * 60 * 1000) {
      await refreshFitbitToken(refreshToken);
    }

    if (!accessToken) {
      logger.warn(LogCategory.Health, '[FitbitHealthProvider] No access token available');
      throw new Error('Fitbit access token not set. Please authenticate first.');
    }

    logger.info(LogCategory.Health, '[FitbitHealthProvider] Initialization successful');

    return {
      accessToken,
      refreshToken,
      tokenExpiresAt,
      tokenRefreshInProgress: false,
      tokenRefreshPromise: null,
      initialized: true,
      lastSyncTime,
    };
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[FitbitHealthProvider] Initialization failed:',
      (error as Error).message
    );
    throw new Error(`Failed to initialize Fitbit provider: ${error}`);
  }
}

export async function refreshFitbitToken(refreshToken: string | null): Promise<void> {
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    logger.info(LogCategory.Health, '[FitbitHealthProvider] Refreshing access token');

    const { data, error } = await supabase.functions.invoke('fitbit-token-refresh', {
      body: { refresh_token: refreshToken },
    });

    if (error) throw error;

    // Store new tokens
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
    await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    await SecureStore.setItemAsync(
      STORAGE_KEYS.TOKEN_EXPIRY,
      (Date.now() + data.expires_in * 1000).toString()
    );

    logger.info(LogCategory.Health, '[FitbitHealthProvider] Token refreshed successfully');
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[FitbitHealthProvider] Token refresh failed:',
      (error as Error).message
    );
    throw new Error(`Failed to refresh token: ${error}`);
  }
}
