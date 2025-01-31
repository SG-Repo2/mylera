import type { HealthPlatform } from '../providers/health/factory/HealthProviderFactory';

/**
 * Map authentication and permission errors to user-friendly messages
 */
export function mapAuthError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes('42501')) {
      return 'Access permission issue. Please contact support.';
    } else if (err.message.includes('HealthKit')) {
      return 'Health services initialization/access issue. Please check your settings.';
    } else if (err.message.includes('HealthConnect')) {
      return 'Health services initialization/access issue. Please check your settings.';
    }
    return err.message;
  }
  return 'An unexpected error occurred.';
}

/**
 * Map platform-specific health provider errors to user-friendly messages
 * with enhanced logging for BasalMetabolicRate permission issues
 */
export function mapHealthProviderError(err: unknown, platform: HealthPlatform): string {
  if (err instanceof Error) {
    // Enhanced logging for BasalMetabolicRate permission issues
    if (err.message.includes('READ_BASAL_METABOLIC_RATE')) {
      console.error(
        `[HealthProvider] BasalMetabolicRate permission denied on ${platform}:`,
        err.message
      );
      return `Unable to access basal metabolic rate data. Please check your ${
        platform === 'apple' ? 'Health' : 'Health Connect'
      } permissions.`;
    }

    if (platform === 'apple') {
      if (err.message.includes('HealthKit')) {
        return 'Unable to access Apple Health. Please check your device settings.';
      }
    } else {
      if (err.message.includes('HealthConnect')) {
        return 'Unable to access Google Health Connect. Please check your device settings.';
      }
    }
    return err.message;
  }
  return `Unable to access health data on ${platform}.`;
}
