/**
 * Dashboard Component Tests
 * 
 * Testing optimization strategies and rendering behavior for the Dashboard component.
 * Includes tests for animation, error handling, and performance optimizations.
 * Tests cover component lifecycle, state management, and user interactions.
 */

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { Dashboard } from '@/src/components/metrics/Dashboard';
import { ErrorView } from '@/src/components/shared/ErrorView';
import { logger } from '@/src/utils/logger';
import { PaperProvider as RealPaperProvider } from 'react-native-paper';
import React from 'react';

// Mock dependencies
jest.mock('react-native-safe-area-context', () => ({
/**
 * Dashboard Component Tests
 * 
 * Testing optimization strategies and rendering behavior for the Dashboard component.
 * Includes tests for animation, error handling, and performance optimizations.
 * Tests cover component lifecycle, state management, and user interactions.
 */

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';
/**
 * Dashboard Component Tests
 * 
 * Testing optimization strategies and rendering behavior for the Dashboard component.
 * Includes tests for animation, error handling, and performance optimizations.
 * Tests cover component lifecycle, state management, and user interactions.
 */

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { Dashboard } from '@/src/components/metrics/Dashboard';
import { ErrorView } from '@/src/components/shared/ErrorView';
import { logger } from '@/src/utils/logger';
import { PaperProvider } from 'react-native-paper';

// Mock dependencies
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/src/components/shared/ErrorView', () => ({
  ErrorView: jest.fn(() => null),
}));

jest.mock('@/src/components/metrics/MetricCard', () => ({
  MetricCard: jest.fn(() => null),
}));

jest.mock('react-native-paper', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#6200EE',
      background: '#F3F4F6',
      surface: '#FFFFFF',
      text: '#222222',
      disabled: '#999999',
      placeholder: '#A9A9A9',
      error: '#B00020',
    },
  })),
}));
const mockAnimatedMetricCard = {
  AnimatedMetricCard: jest.fn(() => null),
};
jest.mock('@/src/components/metrics/AnimatedMetricCard.tsx', () => mockAnimatedMetricCard);

jest.mock('@/src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  LogCategory: {
    Lifecycle: 'lifecycle',
    Rendering: 'rendering',
    Provider: 'provider',
    Error: 'error',
    User: 'user',
  },
}));

// Replace the specific NativeAnimatedHelper mock with a general Animated mock
jest.mock('react-native', () => ({
  Animated: {
    timing: jest.fn(() => ({
      start: jest.fn(),
    })),
    spring: jest.fn(() => ({
      start: jest.fn(),
    })),
    parallel: jest.fn(() => ({
      start: jest.fn(),
    })),
    Value: jest.fn(() => ({
      interpolate: jest.fn(),
      setValue: jest.fn(),
    })),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn((config) => config.ios), // Mock Platform.select
  },
}));

// Spy on Animated.timing and Animated.spring
const mockTiming = jest.spyOn(Animated, 'timing');
const mockSpring = jest.spyOn(Animated, 'spring');
const mockParallel = jest.spyOn(Animated, 'parallel');

// Mock HealthProvider
const createMockProvider = () => ({
  getMetrics: jest.fn().mockResolvedValue({
    id: 'metrics-123',
    user_id: 'user-123',
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
  }),
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
  fetchRawMetrics: jest.fn().mockResolvedValue({}),
  normalizeMetrics: jest.fn().mockReturnValue([]),
  resetState: jest.fn(),
  initializePermissions: jest.fn().mockResolvedValue(undefined),
  handlePermissionDenial: jest.fn().mockResolvedValue(undefined),
  getUserId: jest.fn().mockReturnValue('user-123')
});

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Animated mocks
    mockTiming.mockClear();

    jest.mock('react-native-paper', () => {
      return {
        useTheme: jest.fn(() => ({
          colors: {
            primary: '#6200EE',
            background: '#F3F4F6',
            surface: '#FFFFFF',
            text: '#222222',
            disabled: '#999999',
            placeholder: '#A9A9A9',
            error: '#B00020',
          },
        })),
      };
    });

    jest.mock('@/src/services/supabaseClient', () => ({
      supabase: {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
          })),
        })),
      },
    }));

    jest.mock('react-native-paper', () => {
      const ActualReactNativePaper = jest.requireActual('react-native-paper');
      return {
        ...ActualReactNativePaper,
        useTheme: jest.fn(() => ({
          colors: {
            primary: '#6200EE',
            background: '#F3F4F6',
            surface: '#FFFFFF',
            text: '#222222',
            disabled: '#999999',
            placeholder: '#A9A9A9',
            error: '#B00020',
          },
        })),
      };
    });

    jest.mock('@/src/services/supabaseClient', () => ({
      supabase: {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
          })),
        })),
      },
    }));
    mockSpring.mockClear();
    mockParallel.mockClear();
  });

  const defaultProps = {
    provider: createMockProvider(),
    userId: 'user-123',
    date: '2025-02-24',
    showAlerts: true,
  };

  it('should render loading view initially', () => {
    const { getByText } = render(
      <mockReactNativePaper.PaperProvider>
        <Dashboard {...defaultProps} />
      </mockReactNativePaper.PaperProvider>
    );
    
    expect(getByText('Loading your health data...')).toBeTruthy();
  });

  it('should fetch data on mount', async () => {
    render(<Dashboard {...defaultProps} />);
    
    expect(defaultProps.provider.getMetrics).toHaveBeenCalledTimes(1);
    
    // Verify logger calls
    expect(logger.debug).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Dashboard initializing'),
      expect.any(String),
      'user-123',
      expect.any(Object)
    );
  });

  it('should display metric cards after data loads', async () => {
    const { getByText, queryByText } = render(<Dashboard {...defaultProps} />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(queryByText('Loading your health data...')).toBeNull();
    });
    
    // Check that metrics are displayed
    expect(getByText('Steps')).toBeTruthy();
    expect(getByText('Distance')).toBeTruthy();
    expect(getByText('Calories')).toBeTruthy();
    expect(getByText('Heart Rate')).toBeTruthy();
  });

  it('should trigger animations when data is loaded', async () => {
    render(<Dashboard {...defaultProps} />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(defaultProps.provider.getMetrics).toHaveBeenCalled();
    });
    
    // Check that animations are triggered
    expect(mockParallel).toHaveBeenCalled();
    expect(mockTiming).toHaveBeenCalled();
    expect(mockSpring).toHaveBeenCalled();
  });

  it('should refresh data when pull-to-refresh is triggered', async () => {
    const { getByTestId } = render(<Dashboard {...defaultProps} />);
    
    // Wait for initial data load
    await waitFor(() => {
      expect(defaultProps.provider.getMetrics).toHaveBeenCalled();
    });
    
    // Clear mock to track new calls
    defaultProps.provider.getMetrics.mockClear();
    
    // Find ScrollView with RefreshControl and trigger refresh
    const scrollView = getByTestId('dashboard-scroll-view');
    fireEvent(scrollView, 'refreshControl', { nativeEvent: { refresh: true } });
    
    // Check that data is fetched again
    expect(defaultProps.provider.getMetrics).toHaveBeenCalledTimes(1);
  });

  it('should show error view when data fetch fails', async () => {
    // Mock provider to throw error
    const errorProvider = {
      ...createMockProvider(),
      getMetrics: jest.fn().mockRejectedValue(new Error('Fetch failed')),
    };
    
    render(<Dashboard {...defaultProps} provider={errorProvider} />);
    
    // Wait for error handling
    await waitFor(() => {
      expect(ErrorView).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Fetch failed',
          }),
          onRetry: expect.any(Function),
        }),
        expect.anything()
      );
    });
  });

  it('should retry data fetch when retry button is clicked', async () => {
    // Mock provider to throw error on first call, then succeed
    const retryProvider = {
      ...createMockProvider(),
      getMetrics: jest.fn()
        .mockRejectedValueOnce(new Error('Fetch failed'))
        .mockResolvedValueOnce({
          steps: 9000,
          distance: 4000,
          calories: 500,
          heart_rate: 75,
        }),
    };
    
    render(<Dashboard {...defaultProps} provider={retryProvider} />);
    
    // Wait for error view to be rendered
    await waitFor(() => {
      expect(ErrorView).toHaveBeenCalled();
    });
    
    // Get the retry function from ErrorView props
    const onRetry = (ErrorView as jest.Mock).mock.calls[0][0].onRetry;
    
    // Call the retry function
    act(() => {
      onRetry();
    });
    
    // Check that data is fetched again
    expect(retryProvider.getMetrics).toHaveBeenCalledTimes(2);
  });

  it('should not re-render when props do not change', () => {
    // Spy on React.memo's implementation
    const renderSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    
    console.debug = jest.fn();
    
    const { rerender } = render(<Dashboard {...defaultProps} />);
    
    // First render should log
    expect(logger.debug).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Dashboard initializing'),
      expect.any(String),
      'user-123',
      expect.any(Object)
    );
    
    // Clear logs
    (logger.debug as jest.Mock).mockClear();
    
    // Rerender with the same props
    rerender(<Dashboard {...defaultProps} />);
    
    // Should not log "Dashboard initializing" again due to React.memo optimization
    expect(logger.debug).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Dashboard initializing'),
      expect.any(String),
      expect.any(String),
      expect.any(Object)
    );
    
    // Restore console.debug
    renderSpy.mockRestore();
  });

  it('should re-render when props change', () => {
    const { rerender } = render(<Dashboard {...defaultProps} />);
    
    // Clear logs
    (logger.debug as jest.Mock).mockClear();
    
    // Rerender with different props
    rerender(<Dashboard {...defaultProps} date="2025-02-25" />);
    
    // Should log initialization again due to prop change
    expect(logger.debug).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Dashboard initializing'),
      expect.any(String),
      'user-123',
      expect.any(Object)
    );
  });

  it('should cleanup resources on unmount', () => {
    // Create a spy for AbortController.abort
    const abortSpy = jest.fn();
    global.AbortController = jest.fn().mockImplementation(() => ({
      signal: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
      abort: abortSpy,
    }));
    
    const { unmount } = render(<Dashboard {...defaultProps} />);
    
    // Unmount component
    unmount();
    
    // Verify cleanup logging
    expect(logger.debug).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Dashboard unmounting, cleaning up'),
      expect.any(String),
      'user-123',
    );
    
    // Verify abort was called
    expect(abortSpy).toHaveBeenCalled();
  });
});
