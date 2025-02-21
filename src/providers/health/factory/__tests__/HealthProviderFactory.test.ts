import { HealthProviderFactory } from '../HealthProviderFactory';
import { MockHealthProvider } from '../../__mocks__/MockHealthProvider';
import { HealthProviderError, HealthProviderInitializationError } from '../../types/errors';
import { Platform } from 'react-native';

// Mock Platform.OS
jest.mock('react-native', () => ({
  Platform: { OS: 'android' }
}));

// Mock the provider creation to return our MockHealthProvider
jest.mock('../HealthProviderFactory', () => ({
  ...jest.requireActual('../HealthProviderFactory'),
  createProviderInstance: () => new MockHealthProvider()
}));

describe('HealthProviderFactory', () => {
  const TEST_USER = 'test-user';
  let mockProvider: MockHealthProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    HealthProviderFactory.cleanup();
    mockProvider = new MockHealthProvider();
  });

  describe('provider initialization', () => {
    it('should initialize provider only once for the same platform and user', async () => {
      // First initialization
      const provider1 = await HealthProviderFactory.getProvider('google', TEST_USER);
      expect(provider1.initialize).toHaveBeenCalledTimes(1);
      expect(provider1.initializePermissions).toHaveBeenCalledWith(TEST_USER);

      // Second request should return cached instance
      const provider2 = await HealthProviderFactory.getProvider('google', TEST_USER);
      expect(provider2).toBe(provider1);
      expect(provider1.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization failures and retry', async () => {
      mockProvider.mockInitialize
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(undefined);

      const provider = await HealthProviderFactory.getProvider('google', TEST_USER);
      expect(provider.initialize).toHaveBeenCalledTimes(2);
      expect(provider.initializePermissions).toHaveBeenCalledWith(TEST_USER);
    });

    it('should throw platform-specific errors', async () => {
      Platform.OS = 'ios';
      await expect(
        HealthProviderFactory.getProvider('google', TEST_USER)
      ).rejects.toThrow(HealthProviderError);
    });
  });

  describe('concurrent initialization', () => {
    it('should handle multiple concurrent initialization requests', async () => {
      // Simulate slow initialization
      mockProvider.mockInitialize.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      // Make concurrent requests
      const requests = Array(3).fill(null).map(() =>
        HealthProviderFactory.getProvider('google', TEST_USER)
      );

      const providers = await Promise.all(requests);
      
      // All requests should return the same instance
      expect(new Set(providers).size).toBe(1);
      // Initialize should only be called once
      expect(providers[0].initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization failure for concurrent requests', async () => {
      mockProvider.mockInitialize.mockRejectedValue(new Error('Initialization failed'));

      const requests = Array(3).fill(null).map(() =>
        HealthProviderFactory.getProvider('google', TEST_USER)
      );

      await expect(Promise.all(requests)).rejects.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup specific provider', async () => {
      const provider = await HealthProviderFactory.getProvider('google', TEST_USER);
      const key = 'google:test-user';

      await HealthProviderFactory.cleanup(key);
      expect(provider.cleanup).toHaveBeenCalled();

      // Next request should create new instance
      const newProvider = await HealthProviderFactory.getProvider('google', TEST_USER);
      expect(newProvider).not.toBe(provider);
    });

    it('should cleanup all providers', async () => {
      const provider1 = await HealthProviderFactory.getProvider('google', 'user1');
      const provider2 = await HealthProviderFactory.getProvider('google', 'user2');

      await HealthProviderFactory.cleanup();

      expect(provider1.cleanup).toHaveBeenCalled();
      expect(provider2.cleanup).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const provider = await HealthProviderFactory.getProvider('google', TEST_USER);
      const mockCleanup = jest.spyOn(provider, 'cleanup')
        .mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw
      await expect(HealthProviderFactory.cleanup()).resolves.not.toThrow();
      
      mockCleanup.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should clean up failed initialization state', async () => {
      mockProvider.mockInitialize.mockRejectedValue(new Error('Init failed'));

      await expect(
        HealthProviderFactory.getProvider('google', TEST_USER)
      ).rejects.toThrow();

      expect(mockProvider.cleanup).toHaveBeenCalled();
    });

    it('should allow retry after initialization failure', async () => {
      mockProvider.mockInitialize
        .mockRejectedValueOnce(new Error('First try fails'))
        .mockResolvedValueOnce(undefined);

      // First attempt fails
      await expect(
        HealthProviderFactory.getProvider('google', TEST_USER)
      ).rejects.toThrow();

      // Second attempt should succeed
      const provider = await HealthProviderFactory.getProvider('google', TEST_USER);
      expect(provider).toBeDefined();
    });
  });
});
