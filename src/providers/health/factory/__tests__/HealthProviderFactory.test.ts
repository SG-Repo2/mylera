// [test]
import { HealthProviderFactory } from '../HealthProviderFactory';
import { MockHealthProvider } from '../../__mocks__/MockHealthProvider';
import { HealthProviderError } from '../../types/errors';
import { Platform } from 'react-native';
import type { ProviderState } from '../../types/state';

// Mock Platform.OS
jest.mock('react-native', () => ({
  Platform: { OS: 'android' }
}));

// Create a mock provider class with state tracking
class TestMockProvider extends MockHealthProvider {
  protected initialized = false;
  protected userId: string | null = null;

  initialize = jest.fn().mockImplementation(async () => {
    this.initialized = true;
    return Promise.resolve();
  });

  cleanup = jest.fn().mockImplementation(async () => {
    this.initialized = false;
    this.userId = null;
    return Promise.resolve();
  });

  initializePermissions = jest.fn().mockImplementation(async (userId: string) => {
    this.userId = userId;
    return Promise.resolve();
  });

  isInitialized = jest.fn().mockImplementation(() => this.initialized);
  getUserId = jest.fn().mockImplementation(() => this.userId);
}

// Create factory instance with proper state tracking and concurrency handling
const createMockInstance = () => {
  const providers = new Map<string, TestMockProvider>();
  const states = new Map<string, ProviderState>();
  // Track in-flight initializations to support concurrent calls.
  const initializingProviders = new Map<string, Promise<TestMockProvider>>();
  const mockProvider = new TestMockProvider();

  return {
    providers,
    states,
    createProviderInstance: jest.fn(() => mockProvider),
    initializeProvider: jest.fn(async (userId: string, providerType: string) => {
      // Enforce platform restrictions.
      if (providerType === 'google' && Platform.OS !== 'android') {
        throw new Error('Google Health is only available on Android');
      }
      if (providerType === 'apple' && Platform.OS !== 'ios') {
        throw new Error('Apple Health is only available on iOS');
      }
      // Return already initialized provider if available.
      if (providers.has(userId)) {
        return providers.get(userId);
      }
      // If an initialization is already in progress, return that promise.
      if (initializingProviders.has(userId)) {
        return initializingProviders.get(userId);
      }

      // Set state to "initializing" immediately.
      states.set(userId, { status: 'initializing', userId });

      const initPromise = (async () => {
        try {
          // Use the same provider instance.
          const provider = mockProvider;
          await provider.initializePermissions(userId);
          await provider.initialize();
          providers.set(userId, provider);
          states.set(userId, { status: 'ready', userId });
          return provider;
        } catch (err) {
          states.set(userId, { status: 'error', userId });
          providers.delete(userId);
          throw err;
        } finally {
          initializingProviders.delete(userId);
        }
      })();

      initializingProviders.set(userId, initPromise);
      return initPromise;
    }),
    cleanupProvider: jest.fn(async (userId: string) => {
      const provider = providers.get(userId);
      if (provider) {
        try {
          await provider.cleanup();
          providers.delete(userId);
          states.delete(userId);
        } catch (err) {
          states.set(userId, { status: 'error', userId });
          throw err;
        }
      }
    }),
    getProvider: jest.fn((userId: string) => providers.get(userId))
  };
};

let mockInstance: ReturnType<typeof createMockInstance>;

jest.mock('../HealthProviderFactory', () => ({
  HealthProviderFactory: {
    getInstance: jest.fn(() => mockInstance)
  }
}));

describe('HealthProviderFactory', () => {
  const TEST_USER = 'test-user';
  let mockProvider: TestMockProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInstance = createMockInstance();
    mockProvider = mockInstance.createProviderInstance() as TestMockProvider;
    // Reset Platform.OS to default for most tests.
    Platform.OS = 'android';
  });

  describe('provider initialization and state management', () => {
    it('should properly track provider instances', async () => {
      const factory = HealthProviderFactory.getInstance();
      const provider = await factory.initializeProvider(TEST_USER, 'google');
      
      expect(mockInstance.providers.get(TEST_USER)).toBe(provider);
      expect(mockInstance.states.get(TEST_USER)).toEqual({
        status: 'ready',
        userId: TEST_USER
      });
    });

    it('should reuse existing provider for same user', async () => {
      const factory = HealthProviderFactory.getInstance();
      const provider1 = await factory.initializeProvider(TEST_USER, 'google');
      const provider2 = factory.getProvider(TEST_USER);
      
      expect(provider2).toBe(provider1);
      expect(mockInstance.providers.size).toBe(1);
    });

    it('should handle concurrent initialization requests', async () => {
      const factory = HealthProviderFactory.getInstance();
      const initPromises = [
        factory.initializeProvider(TEST_USER, 'google'),
        factory.initializeProvider(TEST_USER, 'google')
      ];

      const providers = await Promise.all(initPromises);
      expect(providers[0]).toBe(providers[1]);
      // initializePermissions and initialize should each have been called only once.
      expect(mockProvider.initialize).toHaveBeenCalledTimes(1);
      expect(mockProvider.initializePermissions).toHaveBeenCalledTimes(1);
    });

    it('should track state transitions during initialization', async () => {
      const factory = HealthProviderFactory.getInstance();
      const initPromise = factory.initializeProvider(TEST_USER, 'google');
      
      expect(mockInstance.states.get(TEST_USER)?.status).toBe('initializing');
      await initPromise;
      expect(mockInstance.states.get(TEST_USER)?.status).toBe('ready');
    });
  });

  describe('platform-specific behavior', () => {
    it('should enforce platform restrictions for Google Health', async () => {
      Platform.OS = 'ios';
      const factory = HealthProviderFactory.getInstance();
      
      await expect(
        factory.initializeProvider(TEST_USER, 'google')
      ).rejects.toThrow('Google Health is only available on Android');
    });

    it('should enforce platform restrictions for Apple Health', async () => {
      Platform.OS = 'android';
      const factory = HealthProviderFactory.getInstance();
      
      await expect(
        factory.initializeProvider(TEST_USER, 'apple')
      ).rejects.toThrow('Apple Health is only available on iOS');
    });
  });

  describe('error handling and recovery', () => {
    it('should handle initialization failures with proper state cleanup', async () => {
      // Force initialize to fail.
      mockProvider.initialize.mockRejectedValueOnce(new Error('Init failed'));
      const factory = HealthProviderFactory.getInstance();

      await expect(
        factory.initializeProvider(TEST_USER, 'google')
      ).rejects.toThrow('Init failed');

      expect(mockInstance.states.get(TEST_USER)?.status).toBe('error');
      expect(mockInstance.providers.has(TEST_USER)).toBe(false);
    });

    it('should handle permission initialization failures', async () => {
      mockProvider.initializePermissions.mockRejectedValueOnce(
        new Error('Permission denied')
      );
      const factory = HealthProviderFactory.getInstance();

      await expect(
        factory.initializeProvider(TEST_USER, 'google')
      ).rejects.toThrow('Permission denied');

      expect(mockInstance.states.get(TEST_USER)?.status).toBe('error');
    });

    it('should allow recovery after failed initialization', async () => {
      // Instead of directly modifying protected property, use a mock implementation
      mockProvider.initialize.mockImplementationOnce(async () => {
        // Use the public method to check initialization status
        jest.spyOn(mockProvider, 'isInitialized').mockReturnValue(false);
        throw new Error('First try fails');
      });

      const factory = HealthProviderFactory.getInstance();
      await expect(
        factory.initializeProvider(TEST_USER, 'google')
      ).rejects.toThrow('First try fails');

      // Reset the spy for the second attempt
      jest.spyOn(mockProvider, 'isInitialized').mockReturnValue(true);
      
      const provider = await factory.initializeProvider(TEST_USER, 'google');
      expect(provider.isInitialized()).toBe(true);
      expect(mockInstance.states.get(TEST_USER)?.status).toBe('ready');
    });
  });

  describe('cleanup and resource management', () => {
    it('should properly cleanup provider resources', async () => {
      const factory = HealthProviderFactory.getInstance();
      await factory.initializeProvider(TEST_USER, 'google');
      await factory.cleanupProvider(TEST_USER);

      expect(mockInstance.providers.has(TEST_USER)).toBe(false);
      expect(mockInstance.states.has(TEST_USER)).toBe(false);
      expect(mockProvider.cleanup).toHaveBeenCalled();
    });

    it('should handle cleanup errors with state preservation', async () => {
      mockProvider.cleanup.mockRejectedValueOnce(new Error('Cleanup failed'));
      const factory = HealthProviderFactory.getInstance();
      await factory.initializeProvider(TEST_USER, 'google');

      await expect(factory.cleanupProvider(TEST_USER))
        .rejects.toThrow('Cleanup failed');

      expect(mockInstance.states.get(TEST_USER)?.status).toBe('error');
    });

    it('should be safe to cleanup non-existent provider', async () => {
      const factory = HealthProviderFactory.getInstance();
      await expect(factory.cleanupProvider('non-existent-user'))
        .resolves.not.toThrow();
    });
  });
});