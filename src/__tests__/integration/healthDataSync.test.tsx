import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useHealthData } from '../../hooks/useHealthData';
import { HealthProviderFactory } from '../../providers/health/factory/HealthProviderFactory';
import { MetricType } from '../../types/metrics';
import { HealthProvider } from '../../providers/health/types/provider';
import { PermissionStatus } from '../../providers/health/types/permissions';
import { HealthMetrics } from '../../providers/health/types/metrics';
import { metricsService } from '../../services/metricsService';

// Mock the health providers
jest.mock('../../providers/health/platforms/apple/AppleHealthProvider');
jest.mock('../../providers/health/platforms/google/GoogleHealthProvider');

// Mock the metrics service
jest.mock('../../services/metricsService', () => ({
  metricsService: {
    updateMetric: jest.fn().mockResolvedValue(undefined),
  },
}));

// Create a test component that uses the health data hook
interface TestComponentProps {
  provider: HealthProvider;
  userId: string;
}

const TestComponent: React.FC<TestComponentProps> = ({ provider, userId }) => {
  const { loading, error, syncHealthData } = useHealthData(provider, userId);
  
  return (
    <View>
      {loading && <Text testID="loading">Loading...</Text>}
      {error && <Text testID="error">{error.message}</Text>}
      <TouchableOpacity testID="sync-button" onPress={syncHealthData}>
        <Text>Sync</Text>
      </TouchableOpacity>
    </View>
  );
};

describe('Health Data Sync Integration', () => {
  const mockMetrics: HealthMetrics = {
    id: '1',
    user_id: 'test-user',
    date: new Date().toISOString().split('T')[0],
    steps: 10000,
    distance: 5000,
    calories: 400,
    heart_rate: 75,
    exercise: 30,
    basal_calories: 1500,
    flights_climbed: 10,
    daily_score: 85,
    weekly_score: 82,
    streak_days: 5,
    last_updated: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const TEST_USER_ID = 'test-user';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset metrics service mock
    (metricsService.updateMetric as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('iOS Health Integration', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('successfully syncs health data on iOS', async () => {
      // Reset metrics service mock before test
      (metricsService.updateMetric as jest.Mock).mockClear();
      
      // Create a complete mock provider that implements HealthProvider interface
      const mockProvider: HealthProvider = {
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
        initializePermissions: jest.fn().mockResolvedValue(undefined),
        requestPermissions: jest.fn().mockResolvedValue("granted"),
        checkPermissionsStatus: jest.fn().mockResolvedValue({
          status: "granted",
          lastChecked: new Date().toISOString()
        }),
        handlePermissionDenial: jest.fn().mockResolvedValue(undefined),
        getPermissionManager: jest.fn().mockReturnValue(null),
        fetchRawMetrics: jest.fn().mockResolvedValue({}),
        normalizeMetrics: jest.fn().mockReturnValue([]),
        getMetrics: jest.fn().mockResolvedValue({
          ...mockMetrics,
          // Ensure all required metrics are numbers
          steps: 10000,
          distance: 5000,
          calories: 400,
          heart_rate: 75,
          basal_calories: 1500,
          flights_climbed: 10,
          exercise: 30
        }),
        isAvailable: jest.fn().mockResolvedValue(true),
        getLastSyncTime: jest.fn().mockResolvedValue(new Date()),
        setLastSyncTime: jest.fn().mockResolvedValue(undefined)
      };

      // Mock the factory to return our mock provider
      jest.spyOn(HealthProviderFactory, 'getProvider').mockReturnValue(mockProvider);

      const { getByTestId, queryByTestId } = render(
        <TestComponent provider={mockProvider} userId={TEST_USER_ID} />
      );

      // Should show loading initially due to useEffect
      expect(getByTestId('loading')).toBeTruthy();

      // Wait for initial sync to complete with longer timeout
      await waitFor(() => {
        expect(queryByTestId('loading')).toBeNull();
      }, { timeout: 3000 });
      // Verify provider methods were called in correct order
      expect(mockProvider.initializePermissions).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockProvider.checkPermissionsStatus).toHaveBeenCalled();
      expect(mockProvider.getMetrics).toHaveBeenCalled();
      
      // Verify metrics service was called for each metric with a value
      await waitFor(() => {
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'steps', 10000);
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'distance', 5000);
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'calories', 400);
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'heart_rate', 75);
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'basal_calories', 1500);
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'flights_climbed', 10);
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'exercise', 30);
      }, { timeout: 3000 });

      // Trigger manual sync
      act(() => {
        getByTestId('sync-button').props.onPress();
      });

      // Verify loading state during manual sync
      expect(getByTestId('loading')).toBeTruthy();

      // Wait for manual sync to complete
      await waitFor(() => {
        expect(queryByTestId('loading')).toBeNull();
      });

      // Verify cleanup on unmount
      const { unmount } = render(
        <TestComponent provider={mockProvider} userId={TEST_USER_ID} />
      );
      unmount();
      expect(mockProvider.cleanup).toHaveBeenCalled();

      // Verify provider methods were called in correct order
      expect(mockProvider.initializePermissions).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockProvider.checkPermissionsStatus).toHaveBeenCalled();
      expect(mockProvider.getMetrics).toHaveBeenCalled();
    });

    it('handles permission denial on iOS', async () => {
      const mockProvider: HealthProvider = {
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
        initializePermissions: jest.fn().mockResolvedValue(undefined),
        requestPermissions: jest.fn().mockResolvedValue("denied"),
        checkPermissionsStatus: jest.fn().mockResolvedValue({
          status: "denied",
          lastChecked: new Date().toISOString()
        }),
        handlePermissionDenial: jest.fn().mockResolvedValue(undefined),
        getPermissionManager: jest.fn().mockReturnValue(null),
        fetchRawMetrics: jest.fn().mockResolvedValue({}),
        normalizeMetrics: jest.fn().mockReturnValue([]),
        getMetrics: jest.fn(),
        isAvailable: jest.fn().mockResolvedValue(true),
        getLastSyncTime: jest.fn().mockResolvedValue(new Date()),
        setLastSyncTime: jest.fn().mockResolvedValue(undefined)
      };

      jest.spyOn(HealthProviderFactory, 'getProvider').mockReturnValue(mockProvider);

      const { getByTestId, queryByTestId } = render(
        <TestComponent provider={mockProvider} userId={TEST_USER_ID} />
      );

      await waitFor(() => {
        expect(queryByTestId('loading')).toBeNull();
      });

      // Trigger sync
      act(() => {
        getByTestId('sync-button').props.onPress();
      });

      // Should show error
      await waitFor(() => {
        expect(getByTestId('error')).toBeTruthy();
        expect(getByTestId('error').props.children).toContain('permission');
      });

      // Verify getMetrics was not called
      expect(mockProvider.getMetrics).not.toHaveBeenCalled();
    });

    it('handles initialization failure on iOS', async () => {
      const mockProvider: HealthProvider = {
        initialize: jest.fn().mockRejectedValue(new Error('Failed to initialize HealthKit')),
        cleanup: jest.fn().mockResolvedValue(undefined),
        initializePermissions: jest.fn().mockResolvedValue(undefined),
        requestPermissions: jest.fn(),
        checkPermissionsStatus: jest.fn().mockResolvedValue({
          status: "not_determined",
          lastChecked: new Date().toISOString()
        }),
        handlePermissionDenial: jest.fn().mockResolvedValue(undefined),
        getPermissionManager: jest.fn().mockReturnValue(null),
        fetchRawMetrics: jest.fn().mockResolvedValue({}),
        normalizeMetrics: jest.fn().mockReturnValue([]),
        getMetrics: jest.fn(),
        isAvailable: jest.fn().mockResolvedValue(true),
        getLastSyncTime: jest.fn().mockResolvedValue(new Date()),
        setLastSyncTime: jest.fn().mockResolvedValue(undefined)
      };

      jest.spyOn(HealthProviderFactory, 'getProvider').mockReturnValue(mockProvider);

      const { getByTestId, queryByTestId } = render(
        <TestComponent provider={mockProvider} userId={TEST_USER_ID} />
      );

      await waitFor(() => {
        expect(queryByTestId('loading')).toBeNull();
        expect(getByTestId('error')).toBeTruthy();
        expect(getByTestId('error').props.children).toContain('Failed to initialize health provider');
      });

      // Verify subsequent methods were not called
      expect(mockProvider.requestPermissions).not.toHaveBeenCalled();
      expect(mockProvider.getMetrics).not.toHaveBeenCalled();
    });
  });

  describe('Android Health Integration', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('successfully syncs health data on Android', async () => {
      // Reset metrics service mock before test
      (metricsService.updateMetric as jest.Mock).mockClear();
      
      const mockProvider: HealthProvider = {
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
        initializePermissions: jest.fn().mockResolvedValue(undefined),
        requestPermissions: jest.fn().mockResolvedValue("granted"),
        checkPermissionsStatus: jest.fn().mockResolvedValue({
          status: "granted",
          lastChecked: new Date().toISOString()
        }),
        handlePermissionDenial: jest.fn().mockResolvedValue(undefined),
        getPermissionManager: jest.fn().mockReturnValue(null),
        fetchRawMetrics: jest.fn().mockResolvedValue({}),
        normalizeMetrics: jest.fn().mockReturnValue([]),
        getMetrics: jest.fn().mockResolvedValue({
          ...mockMetrics,
          // Ensure all required metrics are numbers
          steps: 10000,
          distance: 5000,
          calories: 400,
          heart_rate: 75,
          basal_calories: 1500,
          flights_climbed: 10,
          exercise: 30
        }),
        isAvailable: jest.fn().mockResolvedValue(true),
        getLastSyncTime: jest.fn().mockResolvedValue(new Date()),
        setLastSyncTime: jest.fn().mockResolvedValue(undefined)
      };

      jest.spyOn(HealthProviderFactory, 'getProvider').mockReturnValue(mockProvider);

      const { getByTestId, queryByTestId } = render(
        <TestComponent provider={mockProvider} userId={TEST_USER_ID} />
      );

      // Wait for initial sync to complete with longer timeout
      await waitFor(() => {
        expect(queryByTestId('loading')).toBeNull();
      }, { timeout: 3000 });

      // Verify no error is shown
      expect(queryByTestId('error')).toBeNull();

      // Trigger sync
      act(() => {
        getByTestId('sync-button').props.onPress();
      });

      // Wait for sync to complete with longer timeout
      await waitFor(() => {
        expect(queryByTestId('loading')).toBeNull();
      }, { timeout: 3000 });

      // Verify still no error
      expect(queryByTestId('error')).toBeNull();

      // Verify provider methods were called in correct order
      expect(mockProvider.initializePermissions).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockProvider.checkPermissionsStatus).toHaveBeenCalled();
      expect(mockProvider.getMetrics).toHaveBeenCalled();

      // Verify metrics service was called for each metric with a value
      await waitFor(() => {
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'steps', 10000);
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'distance', 5000);
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'calories', 400);
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'heart_rate', 75);
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'basal_calories', 1500);
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'flights_climbed', 10);
        expect(metricsService.updateMetric).toHaveBeenCalledWith(TEST_USER_ID, 'exercise', 30);
      }, { timeout: 3000 });
    });

    it('handles permission denial on Android', async () => {
      const mockProvider: HealthProvider = {
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
        initializePermissions: jest.fn().mockResolvedValue(undefined),
        requestPermissions: jest.fn().mockResolvedValue("denied"),
        checkPermissionsStatus: jest.fn().mockResolvedValue({
          status: "denied",
          lastChecked: new Date().toISOString()
        }),
        handlePermissionDenial: jest.fn().mockResolvedValue(undefined),
        getPermissionManager: jest.fn().mockReturnValue(null),
        fetchRawMetrics: jest.fn().mockResolvedValue({}),
        normalizeMetrics: jest.fn().mockReturnValue([]),
        getMetrics: jest.fn(),
        isAvailable: jest.fn().mockResolvedValue(true),
        getLastSyncTime: jest.fn().mockResolvedValue(new Date()),
        setLastSyncTime: jest.fn().mockResolvedValue(undefined)
      };

      jest.spyOn(HealthProviderFactory, 'getProvider').mockReturnValue(mockProvider);

      const { getByTestId, queryByTestId } = render(
        <TestComponent provider={mockProvider} userId={TEST_USER_ID} />
      );

      await waitFor(() => {
        expect(queryByTestId('loading')).toBeNull();
      });

      // Trigger sync
      act(() => {
        getByTestId('sync-button').props.onPress();
      });

      // Should show error
      await waitFor(() => {
        expect(getByTestId('error')).toBeTruthy();
        expect(getByTestId('error').props.children).toContain('permission');
      });

      // Verify getMetrics was not called
      expect(mockProvider.getMetrics).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles network errors during sync', async () => {
      const mockProvider: HealthProvider = {
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
        initializePermissions: jest.fn().mockResolvedValue(undefined),
        requestPermissions: jest.fn().mockResolvedValue("granted"),
        checkPermissionsStatus: jest.fn().mockResolvedValue({
          status: "granted",
          lastChecked: new Date().toISOString()
        }),
        handlePermissionDenial: jest.fn().mockResolvedValue(undefined),
        getPermissionManager: jest.fn().mockReturnValue(null),
        fetchRawMetrics: jest.fn().mockResolvedValue({}),
        normalizeMetrics: jest.fn().mockReturnValue([]),
        getMetrics: jest.fn().mockRejectedValue(new Error('Network error')),
        isAvailable: jest.fn().mockResolvedValue(true),
        getLastSyncTime: jest.fn().mockResolvedValue(new Date()),
        setLastSyncTime: jest.fn().mockResolvedValue(undefined)
      };

      jest.spyOn(HealthProviderFactory, 'getProvider').mockReturnValue(mockProvider);

      const { getByTestId, queryByTestId } = render(
        <TestComponent provider={mockProvider} userId={TEST_USER_ID} />
      );

      await waitFor(() => {
        expect(queryByTestId('loading')).toBeNull();
      });

      // Trigger sync
      act(() => {
        getByTestId('sync-button').props.onPress();
      });

      // Should show error
      await waitFor(() => {
        expect(getByTestId('error')).toBeTruthy();
        expect(getByTestId('error').props.children).toContain('Network error');
      });
    });

    it('handles invalid metric data', async () => {
      const invalidMetrics: Partial<HealthMetrics> = {
        steps: -1, // Invalid negative steps
        distance: 'invalid' as unknown as number, // Invalid type
      };

      const mockProvider: HealthProvider = {
        initialize: jest.fn().mockResolvedValue(undefined),
        cleanup: jest.fn().mockResolvedValue(undefined),
        initializePermissions: jest.fn().mockResolvedValue(undefined),
        requestPermissions: jest.fn().mockResolvedValue("granted"),
        checkPermissionsStatus: jest.fn().mockResolvedValue({
          status: "granted",
          lastChecked: new Date().toISOString()
        }),
        handlePermissionDenial: jest.fn().mockResolvedValue(undefined),
        getPermissionManager: jest.fn().mockReturnValue(null),
        fetchRawMetrics: jest.fn().mockResolvedValue({}),
        normalizeMetrics: jest.fn().mockReturnValue([]),
        getMetrics: jest.fn().mockResolvedValue(invalidMetrics as HealthMetrics),
        isAvailable: jest.fn().mockResolvedValue(true),
        getLastSyncTime: jest.fn().mockResolvedValue(new Date()),
        setLastSyncTime: jest.fn().mockResolvedValue(undefined)
      };

      jest.spyOn(HealthProviderFactory, 'getProvider').mockReturnValue(mockProvider);

      const { getByTestId, queryByTestId } = render(
        <TestComponent provider={mockProvider} userId={TEST_USER_ID} />
      );

      await waitFor(() => {
        expect(queryByTestId('loading')).toBeNull();
      });
    });
  });
});
