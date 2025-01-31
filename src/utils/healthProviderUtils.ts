import { PermissionStatus } from '../providers/health/types/permissions';
import { NormalizedMetric } from '../providers/health/types/metrics';
import { HealthProviderFactory } from '../providers/health/factory/HealthProviderFactory';
import type { HealthPlatform } from '../providers/health/factory/HealthProviderFactory';

/**
 * Initialize health provider for a given user and update permission status
 */
export async function initializeHealthProviderForUser(
  userId: string,
  setHealthStatus: (status: PermissionStatus) => void
): Promise<void> {
  try {
    const provider = HealthProviderFactory.getProvider();
    await provider.initializePermissions(userId);
    const permissionState = await provider.checkPermissionsStatus();
    setHealthStatus(permissionState.status);
  } catch (error) {
    console.error('Error initializing health provider:', error);
    setHealthStatus('not_determined');
  }
}

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
 */
export function mapHealthProviderError(err: unknown, platform: HealthPlatform): string {
  if (err instanceof Error) {
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

/**
 * Transform raw health data into normalized metrics using a provided transform function
 */
export function normalizeMetric<T>(
  rawData: T[],
  transform: (raw: T) => NormalizedMetric
): NormalizedMetric[] {
  return rawData.map(transform);
}

/**
 * Aggregate normalized metrics based on their type
 */
export function aggregateMetrics(metrics: NormalizedMetric[]): number | null {
  if (!metrics.length) return null;

  const metric = metrics[0];
  if (metric.type === 'heart_rate') {
    // Average for heart rate
    const sum = metrics.reduce((acc, m) => acc + (typeof m.value === 'number' ? m.value : 0), 0);
    return Math.round(sum / metrics.length);
  }
  
  // Sum for other metrics
  return Math.round(
    metrics.reduce((acc, m) => acc + (typeof m.value === 'number' ? m.value : 0), 0)
  );
}
