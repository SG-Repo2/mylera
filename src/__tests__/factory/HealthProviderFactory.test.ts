/**
 * Tests for the Health Provider Factory
 */

import { HealthProviderFactory, HealthPlatform } from '@/src/providers/health/factory/HealthProviderFactory';
import { HealthProviderError, HealthProviderInitializationError } from '@/src/providers/health/types/errors';
import { logger } from '@/src/utils/logger';
import { initializeProviderWithRetry } from '@/src/utils/providerInitializationManager';

// Mock dependencies
jest.mock('@/src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  LogCategory: {
    Provider: 'provider'
  }
}));

jest.mock('@/src/utils/providerInitializationManager', () => ({
  initializeProviderWithRetry: jest.fn().mockResolvedValue(undefined),
  safelyCleanupProvider: jest.fn().mockResolvedValue(undefined)
}));

// Mock platform-specific providers
jest.mock('@/src/providers/health/platforms/apple/AppleHealthProvider');
jest.mock('@/src/providers/health/platforms/google/GoogleHealthProvider');
jest.mock('@/src/providers/health/platforms/fitbit/FitbitHealthProvider');

// Mock React Native Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios', // Default to iOS for testing
  select: jest.fn(obj => obj.ios)
}));

// Create mock provider class
class MockHealthProvider {
  initialize = jest.fn().mockResolvedValue(undefined);
  cleanup = jest.fn().mockResolvedValue(undefined);
  setUserId = jest.fn().mockResolvedValue(undefined);
  initializePermissions = jest.fn().mockResolvedValue(undefined);
}

describe('HealthProviderFactory', () => {
  let factory: HealthProviderFactory;
  let mockProvider: MockHealthProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the factory instance for each test
    // @ts-ignore - accessing private static property for testing
    HealthProviderFactory.instance = undefined;
    
    factory = HealthProviderFactory.getInstance();
    mockProvider = new MockHealthProvider();
    
    // Mock the createProviderInstance method to return our mock provider
    // @ts-ignore - accessing private method for testing
    const createProviderSpy = jest.spyOn(factory as any, 'createProviderInstance') as jest.SpyInstance;
    createProviderSpy
      .mockReturnValueOnce(mockProvider)
      .mockReturnValue(mockProvider);
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = HealthProviderFactory.getInstance();
      const instance2 = HealthProviderFactory.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('getProvider', () => {
    it('should throw an error if platform is not specified', async () => {
      await expect(factory.getProvider('' as HealthPlatform, 'user1'))
        .rejects.toThrow(HealthProviderError);
    });

    it('should throw an error if userId is not specified', async () => {
      await expect(factory.getProvider('apple', ''))
        .rejects.toThrow(HealthProviderError);
    });

    it('should initialize and return a provider', async () => {
      const provider = await factory.getProvider('apple', 'user1');
      
      expect(provider).toBe(mockProvider);
      expect(mockProvider.setUserId).toHaveBeenCalledWith('user1');
      expect(mockProvider.initializePermissions).toHaveBeenCalledWith('user1');
      expect(initializeProviderWithRetry).toHaveBeenCalled();
    });

    it('should return the same provider for the same platform and userId', async () => {
      const provider1 = await factory.getProvider('apple', 'user1');
      const provider2 = await factory.getProvider('apple', 'user1');
      
      expect(provider1).toBe(provider2);
      expect(mockProvider.initialize).toHaveBeenCalledTimes(1);
    });

    it('should return different providers for different userIds', async () => {
      const mockProvider2 = new MockHealthProvider();
      
      // Mock createProviderInstance to return different providers for different calls
      // @ts-ignore - accessing private method for testing
      const createProviderSpy = jest.spyOn(factory as any, 'createProviderInstance') as jest.SpyInstance;
      createProviderSpy
        .mockReturnValueOnce(mockProvider)
        .mockReturnValueOnce(mockProvider2);
      
      const provider1 = await factory.getProvider('apple', 'user1');
      const provider2 = await factory.getProvider('apple', 'user2');
      
      expect(provider1).not.toBe(provider2);
      expect(mockProvider.setUserId).toHaveBeenCalledWith('user1');
      expect(mockProvider2.setUserId).toHaveBeenCalledWith('user2');
    });

    it('should handle concurrent initialization requests', async () => {
      // Setup a delayed initialization to simulate concurrent requests
      mockProvider.initialize.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      // Request the provider twice concurrently
      const promise1 = factory.getProvider('apple', 'user1');
      const promise2 = factory.getProvider('apple', 'user1');
      
      // Both promises should resolve to the same provider
      const [provider1, provider2] = await Promise.all([promise1, promise2]);
      
      expect(provider1).toBe(provider2);
      expect(mockProvider.initialize).toHaveBeenCalledTimes(1);
    });

    it('should retry initialization if previous attempt failed', async () => {
      // Mock initialization to fail first time
      mockProvider.initialize
        .mockRejectedValueOnce(new Error('Initialization failed'))
        .mockResolvedValueOnce(undefined);
      
      // Mock initializeProviderWithRetry to simulate failure
      (initializeProviderWithRetry as jest.Mock)
        .mockRejectedValueOnce(new Error('Retry failed'))
        .mockResolvedValueOnce(undefined);
      
      // First call should fail
      await expect(factory.getProvider('apple', 'user1'))
        .rejects.toThrow(HealthProviderInitializationError);
      
      // Second call should succeed
      const provider = await factory.getProvider('apple', 'user1');
      
      expect(provider).toBe(mockProvider);
      expect(initializeProviderWithRetry).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup', () => {
    it('should clean up a specific provider', async () => {
      // Initialize a provider first
      await factory.getProvider('apple', 'user1');
      
      // Then clean it up
      await factory.cleanup('apple:user1');
      
      // Provider should have been cleaned up
      expect(mockProvider.cleanup).toHaveBeenCalledTimes(1);
      
      // Requesting the provider again should re-initialize it
      await factory.getProvider('apple', 'user1');
      
      // Initialize should be called again
      expect(initializeProviderWithRetry).toHaveBeenCalledTimes(2);
    });

    it('should clean up all providers', async () => {
      // Set up two different providers
      const mockProvider2 = new MockHealthProvider();
      
      // Mock createProviderInstance to return different providers
      // @ts-ignore - accessing private method for testing
      const createProviderSpy = jest.spyOn(factory as any, 'createProviderInstance') as jest.SpyInstance;
      createProviderSpy
        .mockReturnValueOnce(mockProvider)
        .mockReturnValueOnce(mockProvider2);
      
      // Initialize two providers
      await factory.getProvider('apple', 'user1');
      await factory.getProvider('google', 'user2');
      
      // Clean up all providers
      await factory.cleanup();
      
      // Both providers should have been cleaned up
      expect(mockProvider.cleanup).toHaveBeenCalledTimes(1);
      expect(mockProvider2.cleanup).toHaveBeenCalledTimes(1);
      
      // Requesting any provider again should re-initialize it
      await factory.getProvider('apple', 'user1');
      
      // Initialize should be called again
      expect(initializeProviderWithRetry).toHaveBeenCalledTimes(3);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Initialize a provider
      await factory.getProvider('apple', 'user1');
      
      // Make cleanup fail
      mockProvider.cleanup.mockRejectedValueOnce(new Error('Cleanup failed'));
      
      // Cleanup should not throw
      await expect(factory.cleanup()).resolves.not.toThrow();
      
      // Error should be logged
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
