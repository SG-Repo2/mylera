import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import { logger, LogCategory } from '@/src/utils/logger';
import { permissions } from './permissions';
import { retryHealthKitOperation } from './utils';

/**
 * Check if the current platform is compatible with HealthKit
 * @throws Error if the platform is not iOS or iOS version is too old
 */
export function checkPlatformCompatibility(): void {
  if (Platform.OS !== 'ios') {
    logger.error(LogCategory.Health, '[AppleHealthProvider] Can only be used on iOS');
    throw new Error('AppleHealthProvider can only be used on iOS');
  }

  // Check iOS version (HealthKit requires iOS 8+)
  const iosVersion = Platform.Version ? parseFloat(Platform.Version.toString()) : null;
  logger.info(LogCategory.Health, `[AppleHealthProvider] iOS version: ${iosVersion}`);

  if (iosVersion !== null && iosVersion < 8) {
    logger.error(LogCategory.Health, '[AppleHealthProvider] HealthKit requires iOS 8 or newer');
    throw new Error('HealthKit requires iOS 8 or newer');
  }
}

/**
 * Initialize Apple HealthKit with the specified permissions
 * @returns Promise that resolves when initialization is complete
 * @throws Error if initialization fails
 */
export async function initializeHealthKit(): Promise<void> {
  logger.info(LogCategory.Health, '[AppleHealthProvider] Initializing HealthKit...');

  try {
    await retryHealthKitOperation(
      () =>
        new Promise<void>((resolve, reject) => {
          AppleHealthKit.initHealthKit(permissions, (error: string) => {
            if (error) {
              reject(new Error(error));
              return;
            }
            resolve();
          });
        }),
      2, // 2 retries
      500 // 500ms initial delay
    );

    logger.info(LogCategory.Health, '[AppleHealthProvider] Successfully initialized');
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[AppleHealthProvider] Initialization failed:',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}
