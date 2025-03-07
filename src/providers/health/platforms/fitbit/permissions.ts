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