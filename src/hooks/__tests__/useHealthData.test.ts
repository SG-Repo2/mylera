import { renderHook, act } from '@testing-library/react-native';
import { useHealthData } from '../useHealthData';
import type { HealthProvider } from '../../providers/health/types/provider';
import { metricsService } from '../../services/metricsService';
import type { Mock } from 'jest-mock';

// Add Jest types to global scope
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInstanceOf(expected: any): R;
    }
  }
}

// Mock the metrics service
jest.mock('../../services/metricsService', () => ({
  metricsService: {
    updateMetric: jest.fn(),
  },
}));

describe('useHealthData', () => {
  // Mock health provider with all required methods
  const mockProvider: jest.Mocked<HealthProvider> = {
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    initializePermissions: jest.fn().mockResolvedValue(undefined),
    requestPermissions: jest.fn().mockResolvedValue('granted'),
    checkPermissionsStatus: jest.fn(),
    handlePermissionDenial: jest.fn().mockResolvedValue(undefined),
    getPermissionManager: jest.fn().mockReturnValue(null),
    fetchRawMetrics: jest.fn().mockResolvedValue({}),
    normalizeMetrics: jest.fn().mockReturnValue([]),
    getMetrics: jest.fn(),
    isAvailable: jest.fn().mockResolvedValue(true),
    getLastSyncTime: jest.fn().mockResolvedValue(null),
    setLastSyncTime: jest.fn().mockResolvedValue(undefined),
  };

  const mockUserId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize and sync health data on mount', async () => {
    // Setup mock implementations
    mockProvider.checkPermissionsStatus.mockResolvedValue({ status: 'granted', lastChecked: Date.now() });
    mockProvider.getMetrics.mockResolvedValue({
      id: '',
      user_id: '',
      date: '2025-01-31',
      steps: 1000,
      distance: 1500,
      calories: 500,
      heart_rate: 75,
      basal_calories: 1800,
      flights_climbed: 10,
      exercise: 30,
      daily_score: 0,
      weekly_score: null,
      streak_days: null,
      last_updated: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Render the hook
    const { result } = renderHook(() => useHealthData(mockProvider, mockUserId));

    // Wait for initial sync to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify initialization flow
    expect(mockProvider.initializePermissions).toHaveBeenCalledWith(mockUserId);
    expect(mockProvider.checkPermissionsStatus).toHaveBeenCalled();
    expect(mockProvider.getMetrics).toHaveBeenCalled();
    expect(metricsService.updateMetric).toHaveBeenCalledTimes(7); // One for each metric with a value

    // Verify hook state
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle permission denial', async () => {
    // Setup mock to simulate permission denial
    mockProvider.checkPermissionsStatus.mockResolvedValue({ status: 'not_determined', lastChecked: Date.now() });
    mockProvider.requestPermissions.mockResolvedValue('denied');

    // Render the hook
    const { result } = renderHook(() => useHealthData(mockProvider, mockUserId));

    // Wait for initial sync to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify error state
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Health permissions denied');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useHealthData(mockProvider, mockUserId));
    
    unmount();
    
    expect(mockProvider.cleanup).toHaveBeenCalled();
  });

  it('should allow manual sync', async () => {
    // Setup initial state
    mockProvider.checkPermissionsStatus.mockResolvedValue({ status: 'granted', lastChecked: Date.now() });
    const mockMetrics = {
      id: '',
      user_id: '',
      date: '2025-01-31',
      steps: 2000,
      distance: 3000,
      calories: 700,
      heart_rate: 80,
      basal_calories: 1900,
      flights_climbed: 15,
      exercise: 45,
      daily_score: 0,
      weekly_score: null,
      streak_days: null,
      last_updated: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // First return initial values, then updated values
    mockProvider.getMetrics
      .mockResolvedValueOnce({ ...mockMetrics, steps: 1000 }) // Initial mount
      .mockResolvedValueOnce({ ...mockMetrics, steps: 2000 }); // Manual sync

    const { result } = renderHook(() => useHealthData(mockProvider, mockUserId));

    // Wait for initial sync to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Clear mocks after initial sync
    jest.clearAllMocks();

    // Trigger manual sync
    await act(async () => {
      await result.current.syncHealthData();
    });

    // Verify only the manual sync calls
    expect(mockProvider.getMetrics).toHaveBeenCalledTimes(1);
    expect(metricsService.updateMetric).toHaveBeenCalledTimes(7);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
