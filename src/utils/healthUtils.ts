import { Platform } from 'react-native';
import type { User } from '@supabase/supabase-js';
import type { HealthPlatform } from '../providers/health/factory/HealthProviderFactory';

/**
 * Determines the appropriate health platform based on user metadata and device platform
 */
export function determineHealthPlatform(user?: User | null): HealthPlatform | undefined {
  if (!user?.user_metadata?.deviceType) {
    console.warn('[healthUtils] No deviceType found in user metadata');
    return undefined;
  }

  const deviceType = user.user_metadata.deviceType;
  console.log('[healthUtils] Determining platform for deviceType:', deviceType);

  switch (deviceType) {
    case 'os':
      const platform = Platform.OS === 'ios' ? 'apple' : 
                      Platform.OS === 'android' ? 'google' : 
                      undefined;
      console.log('[healthUtils] Platform determined:', platform);
      return platform;
    case 'fitbit':
      return 'fitbit';
    default:
      console.warn('[healthUtils] Unknown deviceType:', deviceType);
      return undefined;
  }
} 