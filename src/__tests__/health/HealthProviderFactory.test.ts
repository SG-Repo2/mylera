import { Platform } from 'react-native';
import {
  HealthProviderFactory,
  HealthErrorCode,
} from '@/src/providers/health/factory/HealthProviderFactory';
import { AppleHealthProvider } from '@/src/providers/health/platforms/apple/AppleHealthProvider';
import { GoogleHealthProvider } from '@/src/providers/health/platforms/google/GoogleHealthProvider';
import { FitbitHealthProvider } from '@/src/providers/health/platforms/fitbit/FitbitHealthProvider';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn(obj => obj.ios),
  },
}));

describe('HealthProviderFactory', () => {
  const mockUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset factory state
    HealthProviderFactory.cleanup();
  });

  it('creates Apple Health provider on iOS', async () => {
    Platform.OS = 'ios';

    const provider = await HealthProviderFactory.getProvider('os', mockUserId);
    expect(provider).toBeInstanceOf(AppleHealthProvider);
  });

  it('creates Google Health provider on Android', async () => {
    Platform.OS = 'android';

    const provider = await HealthProviderFactory.getProvider('os', mockUserId);
    expect(provider).toBeInstanceOf(GoogleHealthProvider);
  });

  it('creates Fitbit provider regardless of platform', async () => {
    const provider = await HealthProviderFactory.getProvider('fitbit', mockUserId);
    expect(provider).toBeInstanceOf(FitbitHealthProvider);
  });

  it('throws error for unsupported platform', async () => {
    Platform.OS = 'web';

    await expect(HealthProviderFactory.getProvider('os', mockUserId)).rejects.toThrow(
      HealthErrorCode.UNSUPPORTED_PLATFORM
    );
  });

  it('reuses existing provider instance', async () => {
    const provider1 = await HealthProviderFactory.getProvider('os', mockUserId);
    const provider2 = await HealthProviderFactory.getProvider('os', mockUserId);

    expect(provider1).toBe(provider2);
  });

  it('creates new provider for different user', async () => {
    const provider1 = await HealthProviderFactory.getProvider('os', 'user1');
    const provider2 = await HealthProviderFactory.getProvider('os', 'user2');

    expect(provider1).not.toBe(provider2);
  });

  it('handles initialization errors', async () => {
    const mockError = new Error('Initialization failed');
    jest.spyOn(AppleHealthProvider.prototype, 'initialize').mockRejectedValue(mockError);

    await expect(HealthProviderFactory.getProvider('os', mockUserId)).rejects.toThrow(
      HealthErrorCode.INITIALIZATION_FAILED
    );
  });

  it('prevents concurrent initialization', async () => {
    // Simulate slow initialization
    jest.spyOn(AppleHealthProvider.prototype, 'initialize').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    const promise1 = HealthProviderFactory.getProvider('os', mockUserId);
    const promise2 = HealthProviderFactory.getProvider('os', mockUserId);

    await expect(promise2).rejects.toThrow(HealthErrorCode.INITIALIZATION_IN_PROGRESS);
    await expect(promise1).resolves.toBeInstanceOf(AppleHealthProvider);
  });

  it('cleans up provider resources', async () => {
    const provider = await HealthProviderFactory.getProvider('os', mockUserId);
    const cleanupSpy = jest.spyOn(provider, 'cleanup');

    await HealthProviderFactory.cleanup();

    expect(cleanupSpy).toHaveBeenCalled();
    expect(HealthProviderFactory['instance']).toBeNull();
  });

  it('handles cleanup errors gracefully', async () => {
    const provider = await HealthProviderFactory.getProvider('os', mockUserId);
    jest.spyOn(provider, 'cleanup').mockRejectedValue(new Error('Cleanup failed'));

    await expect(HealthProviderFactory.cleanup()).rejects.toThrow(HealthErrorCode.CLEANUP_FAILED);
  });

  it('retries initialization on failure', async () => {
    let attempts = 0;
    jest.spyOn(AppleHealthProvider.prototype, 'initialize').mockImplementation(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
    });

    const provider = await HealthProviderFactory.getProvider('os', mockUserId);
    expect(provider).toBeInstanceOf(AppleHealthProvider);
    expect(attempts).toBe(3);
  });

  it('gets current platform', async () => {
    await HealthProviderFactory.getProvider('os', mockUserId);
    expect(HealthProviderFactory.getPlatform()).toBe('apple');
  });

  it('throws error when getting platform before initialization', () => {
    expect(() => HealthProviderFactory.getPlatform()).toThrow(
      HealthErrorCode.PROVIDER_NOT_INITIALIZED
    );
  });
}); 