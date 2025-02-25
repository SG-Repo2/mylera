/**
 * Tests for the useHealthData hook
 */
import { renderHook, act } from '@testing-library/react-hooks';
import { useHealthData } from '@/src/hooks/useHealthData';
import { unifiedMetricsService } from '@/src/services/unifiedMetricsService';
import { logger } from '@/src/utils/logger';
import { callWithTimeout } from '@/src/utils/asyncUtils';
import type { Session, User } from '@supabase/supabase-js';
import type { PermissionStatus } from '@/src/providers/health/types/permissions';
import type { ProviderInitializationState } from '@/src/utils/healthInitUtils';

// Mock dependencies
jest.mock('@/src/services/unifiedMetricsService', () => ({
  unifiedMetricsService: {
    getMetrics: jest.fn(),
  },
}));

jest.mock('@/src/utils/asyncUtils', () => ({
  callWithTimeout: jest.fn(),
  DEFAULT_TIMEOUTS: {
    METRICS_FETCH: 15000,
  },
}));

jest.mock('@/src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  LogCategory: {
    Health: 'health',
  },
}));

// Mock auth context
const mockAuthContext = {
  session: null as Session | null,
  user: null as User | null,
  loading: false,
  error: null,
  healthPermissionStatus: 'granted' as PermissionStatus,
  healthInitState: {
    isInitialized: true,
    isInitializing: false,
    permissionStatus: 'granted',
    error: null,
  } as ProviderInitializationState,
  register: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  requestHealthPermissions: jest.fn(),
  needsHealthSetup: jest.fn(),
};

// Mock useAuth hook
jest.mock('@/src/providers/AuthProvider', () => ({
  useAuth: () => mockAuthContext,
}));

// Mock health provider
const createMockProvider = () => ({
  getMetrics: jest.fn().mockResolvedValue(mockMetrics),
  initialize: jest.fn().mockResolvedValue(undefined),
  cleanup: jest.fn().mockResolvedValue(undefined),
  isInitialized: jest.fn().mockReturnValue(true),
  requestPermissions: jest.fn().mockResolvedValue('granted'),
  checkPermissionsStatus: jest.fn().mockResolvedValue({ status: 'granted' }),
  getPermissionManager: jest.fn().mockReturnValue({
    getPermissionState: jest.fn().mockResolvedValue({ status: 'granted', lastChecked: Date.now() }),
    updatePermissionState: jest.fn().mockResolvedValue(undefined),
    handlePermissionDenial: jest.fn().mockResolvedValue(undefined),
    clearCache: jest.fn().mockResolvedValue(undefined)
  }),
  setUserId: jest.fn(),
  initializePermissions: jest.fn().mockResolvedValue(undefined),
  fetchRawMetrics: jest.fn().mockResolvedValue({}),
  normalizeMetrics: jest.fn().mockReturnValue([]),
  resetState: jest.fn(),
  handlePermissionDenial: jest.fn().mockResolvedValue(undefined),
  getUserId: jest.fn().mockReturnValue('test-user-123')
});

// Mock lodash debounce to execute immediately in tests
jest.mock('lodash', () => ({
  debounce: (fn: Function) => {
    const debounced = (...args: any[]) => fn(...args);
    debounced.cancel = jest.fn();
    return debounced;
  },
}));

// Mock metrics data
const mockMetrics = {
  id: 'metrics-123',
  user_id: 'test-user-123',
  date: '2025-02-24',
  steps: 8500,
  distance: 3500,
  calories: 450,
  heart_rate: 72,
  exercise: 30,
  basal_calories: 1200,
  flights_climbed: 8,
  daily_score: 350,
  weekly_score: null,
  streak_days: null,
  last_updated: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('useHealthData hook', () => {
  let mockProvider: ReturnType<typeof createMockProvider>;
  const userId = 'test-user-123';
  let mockAbort: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks
    mockProvider = createMockProvider();
    
    // Setup callWithTimeout mock to pass through to getMetrics
    (callWithTimeout as jest.Mock).mockImplementation((promise) => promise);
    
    // Setup getMetrics mock to resolve with mock data
    (unifiedMetricsService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

    mockAbort = jest.fn();
    // Mock AbortController
    global.AbortController = jest.fn().mockImplementation(() => ({
      signal: {
        aborted: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        onabort: null,
        dispatchEvent: jest.fn()
      },
      abort: mockAbort
    }));
  });

  it('should fetch health data on mount', async () => {
    // Setup fake timers
    jest.useFakeTimers();

    const { result } = renderHook(() => useHealthData(mockProvider, userId));
    
    expect(result.current.loading).toBe(true);
    
    // Wait for initial data fetch
    await act(async () => {
      // Let any pending promises resolve
      await Promise.resolve();
      // Advance timers
      jest.runAllTimers();
      // Let the resolved promises run
      await Promise.resolve();
    });

    // Verify service was called
    expect(unifiedMetricsService.getMetrics).toHaveBeenCalledWith(
      userId,
      undefined,
      mockProvider
    );
    
    // Verify loading state is updated
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockMetrics);
    
    // Cleanup
    jest.useRealTimers();
  }, 10000);

  it('should return data after successful fetch', async () => {
    const { result } = renderHook(() => useHealthData(mockProvider, userId));
    
    await act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });
    
    // Verify updated state
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockMetrics);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch errors properly', async () => {
    // Setup fake timers
    jest.useFakeTimers();

    // Mock getMetrics to reject
    const testError = new Error('Fetch failed');
    (unifiedMetricsService.getMetrics as jest.Mock).mockRejectedValue(testError);
    
    const { result } = renderHook(() => useHealthData(mockProvider, userId));
    
    // Wait for error to be set
    await act(async () => {
      await Promise.resolve(); // Let the error propagate
      jest.runAllTimers(); // Run any pending timers
      await Promise.resolve(); // Let error handlers run
    });
    
    // Verify error state
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('Fetch failed');
    
    // Verify error was logged
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Health data sync error'),
      expect.any(String),
      userId,
      expect.objectContaining({ error: testError })
    );

    // Cleanup
    jest.useRealTimers();
  }, 10000);

  it('should cancel in-flight requests when sync is called again', async () => {
    // Setup fake timers
    jest.useFakeTimers();

    // Mock getMetrics to return a promise that never resolves
    (unifiedMetricsService.getMetrics as jest.Mock).mockImplementation(() =>
      new Promise(() => {})
    );
    
    const { result } = renderHook(() => useHealthData(mockProvider, userId));
    
    // Wait for initial data fetch to start
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(100); // Let initialization complete
      await Promise.resolve();
    });
    
    // Clear mocks to track new calls
    (unifiedMetricsService.getMetrics as jest.Mock).mockClear();
    mockAbort.mockClear();
    
    // Manually trigger sync and wait for it to start
    await act(async () => {
      result.current.syncHealthData();
      await Promise.resolve();
      jest.advanceTimersByTime(100); // Let first sync start
      await Promise.resolve();
      
      // Trigger another sync while the first one is still pending
      result.current.syncHealthData();
      await Promise.resolve();
      jest.advanceTimersByTime(100); // Let second sync start
      await Promise.resolve();
      
      jest.runAllTimers(); // Run any remaining timers
    });
    
    // Verify previous request was aborted
    expect(mockAbort).toHaveBeenCalled();
    
    // Verify new request was made
    expect(unifiedMetricsService.getMetrics).toHaveBeenCalled();

    // Cleanup
    jest.useRealTimers();
  }, 35000);

  it('should clean up resources on unmount', async () => {
    // Setup fake timers
    jest.useFakeTimers();

    // Create mock abort function
    const mockAbort = jest.fn();
    
    // Mock AbortController with proper signal interface
    global.AbortController = jest.fn().mockImplementation(() => ({
      signal: {
        aborted: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        onabort: null,
        dispatchEvent: jest.fn(),
        throwIfAborted: jest.fn()
      },
      abort: mockAbort
    }));
    
    // Mock getMetrics to return a promise that never resolves
    (unifiedMetricsService.getMetrics as jest.Mock).mockImplementation(() =>
      new Promise(() => {})
    );
    
    const { unmount } = renderHook(() => useHealthData(mockProvider, userId));
    
    // Wait for initial data fetch to start
    await act(async () => {
      await Promise.resolve();
      jest.runAllTimers();
    });
    
    // Unmount hook and wait for cleanup
    await act(async () => {
      unmount();
      await Promise.resolve();
      jest.runAllTimers();
    });
    
    // Verify abort was called
    expect(mockAbort).toHaveBeenCalled();
    
    // Verify provider cleanup was called
    expect(mockProvider.cleanup).toHaveBeenCalled();
    
    // Verify cleanup was logged
    expect(logger.debug).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Cleaning up health data hook'),
      expect.any(String),
      userId
    );

    // Cleanup
    jest.useRealTimers();
  }, 10000);

  it('should not update state if component is unmounted', async () => {
    // Setup fake timers
    jest.useFakeTimers();

    // Create a deferred promise for getMetrics
    let resolveMetrics: (value: any) => void;
    const metricsPromise = new Promise((resolve) => {
      resolveMetrics = resolve;
    });
    (unifiedMetricsService.getMetrics as jest.Mock).mockReturnValue(metricsPromise);
    
    const { result, unmount } = renderHook(() => useHealthData(mockProvider, userId));
    
    // Wait for initial fetch to start
    await act(async () => {
      await Promise.resolve();
      jest.runAllTimers();
    });
    
    // Verify initial state
    expect(result.current.loading).toBe(true);
    
    // Unmount component and wait for cleanup
    await act(async () => {
      unmount();
      await Promise.resolve();
      jest.runAllTimers();
    });
    
    // Resolve the promise after unmount
    await act(async () => {
      resolveMetrics(mockMetrics);
      await Promise.resolve();
      jest.runAllTimers();
    });
    
    // State should not have been updated
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    // Cleanup
    jest.useRealTimers();
  }, 10000);

  it('should properly handle AbortError', async () => {
    // Setup fake timers
    jest.useFakeTimers();

    // Mock getMetrics to reject with AbortError
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    (unifiedMetricsService.getMetrics as jest.Mock).mockRejectedValue(abortError);
    
    const { result } = renderHook(() => useHealthData(mockProvider, userId));
    
    // Wait for operation to complete
    await act(async () => {
      await Promise.resolve(); // Let the error propagate
      jest.runAllTimers(); // Run any pending timers
      await Promise.resolve(); // Let error handlers run
    });
    
    // Error should not be set for AbortError
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    
    // Verify debug log was called for abort
    expect(logger.debug).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Sync request aborted'),
      expect.any(String),
      userId
    );

    // Cleanup
    jest.useRealTimers();
  }, 10000);

  it('should handle timeout errors', async () => {
    // Setup fake timers
    jest.useFakeTimers();

    // Mock callWithTimeout to reject with TimeoutError
    const timeoutError = new Error('Operation timed out');
    timeoutError.name = 'TimeoutError';
    (callWithTimeout as jest.Mock).mockRejectedValue(timeoutError);
    
    const { result } = renderHook(() => useHealthData(mockProvider, userId));
    
    // Wait for error to be set
    await act(async () => {
      await Promise.resolve(); // Let the error propagate
      jest.runAllTimers(); // Run any pending timers
      await Promise.resolve(); // Let error handlers run
    });
    
    // Verify error state with user-friendly message
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('timed out');

    // Verify error was logged
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Health data sync error'),
      expect.any(String),
      userId,
      expect.objectContaining({ error: timeoutError })
    );

    // Cleanup
    jest.useRealTimers();
  }, 10000);

  it('should not trigger sync if provider is not initialized', async () => {
    // Setup fake timers
    jest.useFakeTimers();

    // Create a new context with uninitialized state
    const uninitializedContext = {
      ...mockAuthContext,
      healthInitState: {
        isInitialized: false,
        isInitializing: false,
        permissionStatus: 'granted',
        error: null,
      },
    };

    // Mock useAuth to return uninitialized state
    jest.spyOn(require('@/src/providers/AuthProvider'), 'useAuth')
      .mockReturnValue(uninitializedContext);

    const { result } = renderHook(() => useHealthData(mockProvider, userId));
    
    // Wait for any potential initialization
    await act(async () => {
      await Promise.resolve();
      jest.runAllTimers();
      await Promise.resolve();
    });
    
    // Verify no sync was triggered
    expect(unifiedMetricsService.getMetrics).not.toHaveBeenCalled();
    
    // Manually trigger sync
    await act(async () => {
      result.current.syncHealthData();
      await Promise.resolve();
      jest.runAllTimers();
    });
    
    // Verify sync was logged but not executed
    expect(logger.debug).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Skipping sync'),
      expect.any(String),
      userId
    );

    // Cleanup
    jest.useRealTimers();
  }, 35000);

  it('should not trigger multiple syncs if one is in progress', async () => {
    // Make getMetrics never resolve to simulate long-running operation
    (unifiedMetricsService.getMetrics as jest.Mock).mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );
    
    const { result } = renderHook(() => useHealthData(mockProvider, userId));
    
    // First sync is triggered on mount
    
    // Clear mock to track new calls
    (unifiedMetricsService.getMetrics as jest.Mock).mockClear();
    
    // Try to trigger sync again
    await act(async () => {
      result.current.syncHealthData();
    });
    
    // Verify no new sync was triggered
    expect(unifiedMetricsService.getMetrics).not.toHaveBeenCalled();
    
    // Verify skipping was logged
    expect(logger.debug).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Sync already in progress'),
      expect.any(String),
      userId
    );
  });
});
