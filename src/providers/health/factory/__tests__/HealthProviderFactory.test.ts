import { HealthProviderFactory } from '../HealthProviderFactory';
import { BaseHealthProvider } from '../../types/provider';
import { HealthProviderError, HealthProviderInitializationError } from '../../types/errors';
import type { HealthProvider } from '../../types';
import type { PermissionState } from '../../types/permissions';
import type { HealthMetrics, RawHealthData } from '../../types/metrics';

// Mock provider for testing
class MockHealthProvider extends BaseHealthProvider {
  mockInitialize = jest.fn();
  mockCheckPermissions = jest.fn();
  mockRequestPermissions = jest.fn();

  async performInitialization(): Promise<void> {
    await this.mockInitialize();
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    return this.mockCheckPermissions();
  }

  async requestPermissions(): Promise<'granted' | 'denied' | 'limited' | 'provisional'> {
    return this.mockRequestPermissions();
  }

  async fetchRawMetrics(): Promise<RawHealthData> {
    return {};
  }

  async getMetrics(): Promise<HealthMetrics> {
    const now = new Date();
    return {
      id: '',
      user_id: '',
      date: now.toISOString().split('T')[0],
      steps: 0,
      distance: 0,
      calories: 0,
      heart_rate: 0,
      basal_calories: 0,
      flights_climbed: 0,
      exercise: 0,
      daily_score: 0,
      weekly_score: null,
      streak_days: null,
      last_updated: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }
}

describe('HealthProviderFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clean up any existing providers
    HealthProviderFactory.cleanup();
  });

  describe('permission management', () => {
    test('maintains permission state between initializations', async () => {
      const mockProvider = new MockHealthProvider();
      mockProvider.mockCheckPermissions.mockResolvedValue({ status: 'granted', lastChecked: Date.now() });
      mockProvider.mockRequestPermissions.mockResolvedValue('granted');

      // First initialization
      await HealthProviderFactory.getProvider('os', 'test-user');
      expect(mockProvider.mockCheckPermissions).toHaveBeenCalledTimes(1);

      // Second initialization should use cached permission state
      await HealthProviderFactory.getProvider('os', 'test-user');
      expect(mockProvider.mockCheckPermissions).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    test('handles limited permissions', async () => {
      const mockProvider = new MockHealthProvider();
      mockProvider.mockCheckPermissions.mockResolvedValue({ status: 'limited', lastChecked: Date.now() });
      mockProvider.mockRequestPermissions.mockResolvedValue('limited');

      const provider = await HealthProviderFactory.getProvider('os', 'test-user');
      expect(provider).toBeDefined();
      expect(mockProvider.mockCheckPermissions).toHaveBeenCalled();
    });

    test('handles provisional permissions', async () => {
      const mockProvider = new MockHealthProvider();
      mockProvider.mockCheckPermissions.mockResolvedValue({ status: 'provisional', lastChecked: Date.now() });
      mockProvider.mockRequestPermissions.mockResolvedValue('granted');

      const provider = await HealthProviderFactory.getProvider('os', 'test-user');
      expect(provider).toBeDefined();
      expect(mockProvider.mockRequestPermissions).toHaveBeenCalled();
    });

    test('handles permission state transitions', async () => {
      const mockProvider = new MockHealthProvider();
      let permissionState: PermissionState = { status: 'provisional', lastChecked: Date.now() };
      
      mockProvider.mockCheckPermissions.mockImplementation(() => Promise.resolve(permissionState));
      mockProvider.mockRequestPermissions.mockImplementation(async () => {
        permissionState = { status: 'granted', lastChecked: Date.now() };
        return 'granted';
      });

      const provider = await HealthProviderFactory.getProvider('os', 'test-user');
      expect(provider).toBeDefined();
      expect(mockProvider.mockRequestPermissions).toHaveBeenCalled();
      expect(permissionState.status).toBe('granted');
    });

    test('handles permission denial cleanup', async () => {
      const mockProvider = new MockHealthProvider();
      mockProvider.mockCheckPermissions.mockResolvedValue({ status: 'denied', lastChecked: Date.now() });
      mockProvider.mockRequestPermissions.mockResolvedValue('denied');

      await expect(
        HealthProviderFactory.getProvider('os', 'test-user')
      ).rejects.toThrow(HealthProviderError);

      // Should clean up after denial
      expect(await HealthProviderFactory.getProvider('os', 'test-user')
        .catch(() => null)).toBeNull();
    });
  });

  describe('error handling', () => {
    test('handles token refresh failures', async () => {
      const mockProvider = new MockHealthProvider();
      let attempts = 0;
      mockProvider.mockCheckPermissions.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Token refresh failed');
        }
        return { status: 'granted', lastChecked: Date.now() };
      });

      const provider = await HealthProviderFactory.getProvider('os', 'test-user');
      expect(provider).toBeDefined();
      expect(attempts).toBe(3); // Should succeed after retries
    });

    test('handles initialization cleanup on failure', async () => {
      const mockProvider = new MockHealthProvider();
      mockProvider.mockInitialize.mockRejectedValue(new Error('Initialization failed'));

      await expect(
        HealthProviderFactory.getProvider('os', 'test-user')
      ).rejects.toThrow(HealthProviderInitializationError);

      // Should be cleaned up after failure
      expect(await HealthProviderFactory.getProvider('os', 'test-user')
        .catch(() => null)).toBeNull();
    });
  });

  test('maintains permission state between initializations', async () => {
    const mockProvider = new MockHealthProvider();
    mockProvider.mockCheckPermissions.mockResolvedValue({ status: 'granted', lastChecked: Date.now() });
    mockProvider.mockRequestPermissions.mockResolvedValue('granted');

    // First initialization
    await HealthProviderFactory.getProvider('os', 'test-user');
    expect(mockProvider.mockCheckPermissions).toHaveBeenCalledTimes(1);

    // Second initialization should use cached permission state
    await HealthProviderFactory.getProvider('os', 'test-user');
    expect(mockProvider.mockCheckPermissions).toHaveBeenCalledTimes(1); // Still 1, not 2
  });
});
  describe('initialization', () => {
    test('handles concurrent initialization requests', async () => {
      const mockProvider = new MockHealthProvider();
      let initCount = 0;
      mockProvider.mockInitialize.mockImplementation(async () => {
        initCount++;
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async work
      });

      // Start multiple concurrent initializations
      const promises = Array(3).fill(null).map(() => 
        HealthProviderFactory.getProvider('os', 'test-user')
      );

      await Promise.all(promises);

      // Should only initialize once despite multiple requests
      expect(initCount).toBe(1);
    });

    test('respects initialization timeout', async () => {
      const mockProvider = new MockHealthProvider();
      mockProvider.mockInitialize.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 35000)); // Longer than timeout
      });

      await expect(
        HealthProviderFactory.getProvider('os', 'test-user')
      ).rejects.toThrow(HealthProviderInitializationError);
    });

    test('handles initialization with permissions granted', async () => {
      const mockProvider = new MockHealthProvider();
      mockProvider.mockCheckPermissions.mockResolvedValue({ status: 'granted', lastChecked: Date.now() });
      mockProvider.mockRequestPermissions.mockResolvedValue('granted');

      const provider = await HealthProviderFactory.getProvider('os', 'test-user');
      expect(provider).toBeDefined();
      expect(mockProvider.mockCheckPermissions).toHaveBeenCalled();
    });

    test('handles initialization with permissions denied', async () => {
      const mockProvider = new MockHealthProvider();
      mockProvider.mockCheckPermissions.mockResolvedValue({ status: 'denied', lastChecked: Date.now() });
      mockProvider.mockRequestPermissions.mockResolvedValue('denied');

      await expect(
        HealthProviderFactory.getProvider('os', 'test-user')
      ).rejects.toThrow(HealthProviderError);
    });

    test('retries initialization on failure', async () => {
      const mockProvider = new MockHealthProvider();
      let attempts = 0;
      mockProvider.mockInitialize.mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Initialization failed');
        }
      });

      await HealthProviderFactory.getProvider('os', 'test-user');
      expect(attempts).toBe(2); // Should succeed on second attempt
    });
  });
