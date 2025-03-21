// (This file is optional. Fitbit's API scopes are generally set during OAuth registration.)
export const HEALTH_PERMISSIONS = {
    // Define any custom permission keys or scopes if needed.
    // For example:
    activity: 'activity',
    heartrate: 'heartrate',
    sleep: 'sleep',
    profile: 'profile'
  };

// Token management configuration
export const TOKEN_CONFIG = {
  // Token refresh buffer (refresh token if expiring within this time)
  REFRESH_BUFFER: 5 * 60 * 1000, // 5 minutes in milliseconds
  
  // Maximum retries for token refresh
  MAX_REFRESH_RETRIES: 3,
  
  // Delay between refresh retries
  REFRESH_RETRY_DELAY: 1000, // 1 second
  
  // Token refresh timeout
  REFRESH_TIMEOUT: 10000, // 10 seconds
  
  // Storage keys for secure token storage
  STORAGE_KEYS: {
    ACCESS_TOKEN: 'fitbit_access_token',
    REFRESH_TOKEN: 'fitbit_refresh_token',
    TOKEN_EXPIRY: 'fitbit_token_expiry',
    LAST_SYNC: 'fitbit_last_sync'
  }
};

// Required OAuth scopes for Fitbit API
export const REQUIRED_SCOPES = [
  'activity',
  'heartrate',
  'profile',
  'sleep',
  'weight'
] as const;

// Permission groups by feature
export const PERMISSION_GROUPS = {
  activity: ['activity', 'heartrate'],
  profile: ['profile'],
  health: ['sleep', 'weight']
};

// Helper to validate scopes
export const hasRequiredScopes = (grantedScopes: string[]): boolean => {
  return REQUIRED_SCOPES.every(scope => grantedScopes.includes(scope));
};

import * as AuthSession from 'expo-auth-session';
import { supabase } from '../../../../services/supabaseClient';
import { logger, LogCategory } from '@/src/utils/logger';
import { PermissionStatus } from '../../types/permissions';
import { STORAGE_KEYS } from './utils';
import * as SecureStore from 'expo-secure-store';
import { FitbitTokenData } from './types';

export async function requestFitbitPermissions(): Promise<PermissionStatus> {
  try {
    const clientId = process.env.EXPO_PUBLIC_FITBIT_CLIENT_ID!;
    const redirectUri = 'mylera://auth/callback';
    const authUrl = process.env.EXPO_PUBLIC_FITBIT_AUTH_URL!;

    // Configure Auth Request
    const discovery = {
      authorizationEndpoint: authUrl,
      tokenEndpoint: process.env.EXPO_PUBLIC_FITBIT_TOKEN_URL!,
    };

    const request = new AuthSession.AuthRequest({
      clientId,
      scopes: ['activity', 'heartrate', 'profile', 'sleep', 'weight'],
      redirectUri,
      usePKCE: true,
    });

    const result = await request.promptAsync(discovery);
    
    if (result.type === 'success' && result.params.code) {
      // Exchange code for token using Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('fitbit-token-exchange', {
        body: {
          code: result.params.code,
          redirectUri,
          codeVerifier: request.codeVerifier,
        },
      });

      if (error) throw error;

      // Store tokens securely
      await storeTokens(data);
      return 'granted';
    }

    throw new Error('OAuth flow failed or was cancelled');
  } catch (error) {
    logger.error(LogCategory.Health, '[FitbitHealthProvider] Permission request failed:', (error as Error).message);
    return 'denied';
  }
}

export async function storeTokens(tokenData: FitbitTokenData): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, tokenData.access_token);
  await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, tokenData.refresh_token);
  await SecureStore.setItemAsync(
    STORAGE_KEYS.TOKEN_EXPIRY,
    (Date.now() + tokenData.expires_in * 1000).toString()
  );
}

export async function checkFitbitPermissions(): Promise<PermissionStatus> {
  const accessToken = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  return accessToken ? 'granted' : 'not_determined';
}

export async function clearFitbitPermissions(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN_EXPIRY);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.LAST_SYNC);
}