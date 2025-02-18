import { renderHook, act } from '@testing-library/react-native';
import { useHealthData } from '@/src/hooks/useHealthData';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';
import { metricsService } from '@/src/services/metricsService';
import { supabase } from '@/src/services/supabaseClient';
import { mockHealthData } from '../utils/testHelpers';

// Mock dependencies
jest.mock('@/src/providers/health/factory/HealthProviderFactory');
jest.mock('@/src/services/metricsService');
jest.mock('@/src/services/supabaseClient');

describe('useHealthData', () => {
  const mockUserId = 'test-user-123';
  const mockProvider = {
    initialize: jest.fn(),
    getMetrics: jest.fn().mockResolvedValue(mockHealthData),
    checkPermissionsStatus: jest.fn().mockResolvedValue({ status: 'granted' }),
    cleanup: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock HealthProviderFactory
    (HealthProviderFactory.getProvider as jest.Mock).mockResolvedValue(mockProvider);

    // Mock Supabase user profile query
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { device_type: 'os' },
        error: null,
      }),
    });
  });

  it('initializes with loading state', () => {
    const { result } = renderHook(() => useHealthData(mockUserId));

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.isInitialized).toBe(false);
  });

  it('successfully initializes health provider', async () => {
    const { result } = renderHook(() => useHealthData(mockUserId));

    // Wait for initialization to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isInitialized).toBe(true);
    expect(result.current.provider).toBe(mockProvider);
  });

  it('handles initialization errors', async () => {
    const mockError = new Error('Initialization failed');
    (HealthProviderFactory.getProvider as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(() => useHealthData(mockUserId));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.isInitialized).toBe(true);
  });

  it('syncs health data successfully', async () => {
    const { result } = renderHook(() => useHealthData(mockUserId));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      await result.current.syncHealthData();
    });

    expect(metricsService.updateMetric).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('handles health data sync errors', async () => {
    mockProvider.getMetrics.mockRejectedValue(new Error('Sync failed'));

    const { result } = renderHook(() => useHealthData(mockUserId));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      await result.current.syncHealthData();
    });

    expect(result.current.error).toBeTruthy();
  });

  it('handles permission errors', async () => {
    mockProvider.checkPermissionsStatus.mockResolvedValue({ status: 'denied' });

    const { result } = renderHook(() => useHealthData(mockUserId));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('permissions');
  });

  it('handles network errors', async () => {
    mockProvider.getMetrics.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useHealthData(mockUserId));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      await result.current.syncHealthData();
    });

    expect(result.current.error?.message).toContain('Network error');
  });

  it('cleans up on unmount', async () => {
    const { result, unmount } = renderHook(() => useHealthData(mockUserId));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    unmount();

    expect(mockProvider.cleanup).toHaveBeenCalled();
  });

  it('handles missing user profile', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });

    const { result } = renderHook(() => useHealthData(mockUserId));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.error?.message).toContain('User profile not found');
  });

  it('retries failed health data fetches', async () => {
    let attempts = 0;
    mockProvider.getMetrics.mockImplementation(async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('Temporary failure');
      }
      return mockHealthData;
    });

    const { result } = renderHook(() => useHealthData(mockUserId));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      await result.current.syncHealthData();
    });

    expect(attempts).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('updates loading state during operations', async () => {
    const loadingStates: boolean[] = [];
    const { result } = renderHook(() => useHealthData(mockUserId));

    result.current.loading && loadingStates.push(true);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      result.current.loading && loadingStates.push(true);
      await result.current.syncHealthData();
      result.current.loading && loadingStates.push(true);
    });

    expect(loadingStates).toEqual([true]); // Should be true only initially
  });
}); 