import { Platform } from 'react-native';
import { initialize } from 'react-native-health-connect';
import { logger, LogCategory } from '@/src/utils/logger';
import { retryOperation } from './utils';

export async function performInitialization(): Promise<void> {
  if (Platform.OS !== 'android') {
    logger.error(
      LogCategory.Health,
      '[GoogleHealthProvider] Attempted to initialize on non-Android platform'
    );
    throw new Error('GoogleHealthProvider can only be used on Android');
  }

  // Check Android version for Health Connect compatibility
  const androidVersion = Platform.Version ? parseInt(Platform.Version.toString(), 10) : null;
  logger.info(LogCategory.Health, `[GoogleHealthProvider] Android version: ${androidVersion}`);

  if (androidVersion !== null && androidVersion < 8) {
    logger.error(
      LogCategory.Health,
      '[GoogleHealthProvider] Health Connect requires Android 8 or newer'
    );
    throw new Error('Health Connect requires Android 8 or newer');
  }

  logger.info(LogCategory.Health, '[GoogleHealthProvider] Starting initialization...');

  try {
    // Use retry mechanism with exponential backoff
    const available = await retryOperation(
      () => initialize(),
      3, // 3 retries
      1000 // 1 second initial delay
    );

    logger.info(
      LogCategory.Health,
      '[GoogleHealthProvider] Health Connect availability:',
      available ? 'available' : 'not available'
    );

    if (!available) {
      logger.error(LogCategory.Health, '[GoogleHealthProvider] Health Connect is not available');
      throw new Error('Health Connect is not available');
    }

    logger.info(LogCategory.Health, '[GoogleHealthProvider] Initialization successful');
    return;
  } catch (error) {
    logger.error(
      LogCategory.Health,
      '[GoogleHealthProvider] Initialization failed:',
      (error as Error).message
    );
    // Wrap the error to ensure consistent messaging
    if (error instanceof Error) {
      if (error.message.includes('not available')) {
        throw new Error('Health Connect is not available');
      }
    }
    throw error;
  }
}
