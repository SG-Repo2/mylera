import React from 'react';
import type { FC, ReactElement } from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Dashboard } from '@/src/components/metrics/Dashboard';
import { HealthMetrics } from '@/src/providers/health';
import { useDashboardData } from '@/src/hooks/useDashboardData';
import { useDashboardAnimations } from '@/src/hooks/useDashboardAnimations';
import { useAuth } from '@/src/providers/auth';
import { HealthProviderPermissionError } from '@/src/providers/health/types/errors';
import { RefreshControl, Animated, View, Text, TouchableOpacity } from 'react-native';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import type { DailyTotal } from '@/src/types/schemas';

// Mocks
jest.mock('@/src/hooks/useDashboardData');
jest.mock('@/src/hooks/useDashboardAnimations');
jest.mock('@/src/providers/auth');
// Mock components with proper types
jest.mock('@/src/components/shared/ErrorView', () => ({
  ErrorView: (({ error, onRetry }: { error?: Error; onRetry?: () => void }): ReactElement => {
    return (
      <View testID="error-view">
        <Text testID="error-message">{error?.message}</Text>
        <TouchableOpacity testID="retry-button" onPress={onRetry}>
          <Text>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }) as FC<{ error?: Error; onRetry?: () => void }>,
}));
}));

interface MetricCardListProps {
  metrics: HealthMetrics;
  showAlerts?: boolean;
  provider: HealthProvider;
  isInitialLoad?: boolean;
  isManualRefresh?: boolean;
  availableMetrics: Set<string>;
}

jest.mock('@/src/components/metrics/MetricCardList', () => ({
  MetricCardList: ({ metrics, showAlerts, provider, isInitialLoad, isManualRefresh, availableMetrics }: MetricCardListProps) => (
    <View testID="metric-card-list">
      <Text testID="metrics-data">{JSON.stringify(metrics)}</Text>
    </View>
  ),
}));

// Mock custom dialog implementation to capture onDismiss callback
let mockDialogDismiss: (() => void) | null = null;

jest.mock('react-native-paper', () => {
  const ReactNative = require('react-native'); // Import RN components to avoid recursive calls
  return {
    ...jest.requireActual('react-native-paper'),
    useTheme: () => ({
      colors: {
        primary: '#3498db',
        surface: '#ffffff',
        error: '#e74c3c',
        onSurface: '#000000',
        onSurfaceVariant: '#666666',
      },
      roundness: 8,
    }),
    Portal: ({ children }: { children: React.ReactNode }) => (
      <View testID="portal">{children}</View>
    ),
    Dialog: {
      Title: ({ style, children }: { style?: any; children: React.ReactNode }) => (
        <View testID="dialog-title" style={style}>{children}</View>
      ),
      Content: ({ children }: { children: React.ReactNode }) => (
        <View testID="dialog-content">{children}</View>
      ),
      Actions: ({ style, children }: { style?: any; children: React.ReactNode }) => (
        <View testID="dialog-actions" style={style}>{children}</View>
      ),
    },
    Text: ({ onPress, style, children }: { onPress?: () => void, style?: any, children: React.ReactNode }) => {
      if (children === 'OK') {
        mockDialogDismiss = onPress || null;
      }
      // Use React Native's Text component here to avoid recursion
      return (
        <ReactNative.Text onPress={onPress} style={style} testID={children === 'OK' ? 'dialog-ok-button' : undefined}>
          {children}
        </ReactNative.Text>
      );
    }
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock Animated
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

describe('Dashboard Component', () => {
  // Mock provider and userId for tests
  const mockProvider: HealthProvider = {
    initialize: jest.fn(),
    cleanup: jest.fn(),
    getMetrics: jest.fn(),
    initializeWithPermissions: jest.fn(),
    checkPermissionsStatus: jest.fn(),
    requestPermissions: jest.fn(),
    fetchRawMetrics: jest.fn(),
    normalizeMetrics: jest.fn(),
    safeInitialize: jest.fn(),
  };
  const mockUserId = 'test-user-123';
  
  // Mock hook values
  const mockDailyTotal: DailyTotal = {
    id: 'test-daily-total',
    user_id: mockUserId,
    date: '2023-01-01',
    total_points: 500,
    metrics_completed: 5,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };
  
  const mockHealthMetrics: HealthMetrics = {
    id: 'test-health-metrics',
    user_id: mockUserId,
    date: '2023-01-01',
    steps: 10000,
    distance: 5000,
    calories: 500,
    heart_rate: 75,
    exercise: 30,
    basal_calories: 1500,
    flights_climbed: 10,
    daily_score: 500,
    weekly_score: null,
    streak_days: null,
    last_updated: '2023-01-01T00:00:00Z',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };
  
  const mockAvailableMetrics = new Set([
    'steps', 'distance', 'calories', 'heart_rate', 'exercise', 'basal_calories', 'flights_climbed'
  ]);
  
  // Mock animations
  const mockHeaderAnimations = {
    opacity: new Animated.Value(1),
    transform: [{ translateY: new Animated.Value(0) }]
  };
  
  const mockLoadingAnimations = {
    scale: new Animated.Value(1),
    rotate: { interpolate: jest.fn().mockReturnValue('0deg') }
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockDialogDismiss = null;
    
    // Setup default mock hook implementations
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: null,
      healthMetrics: null,
      loading: true,
      error: null,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: jest.fn(),
      availableMetrics: new Set(),
    });
    
    (useDashboardAnimations as jest.Mock).mockReturnValue({
      headerAnimations: mockHeaderAnimations,
      loadingAnimations: mockLoadingAnimations,
    });
    
    (useAuth as jest.Mock).mockReturnValue({
      healthPermissionStatus: 'granted',
      requestHealthPermissions: jest.fn().mockResolvedValue('granted'),
    });
  });
  
  test('renders loading state when data is being fetched', () => {
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: null,
      healthMetrics: null,
      loading: true,
      error: null,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: jest.fn(),
      availableMetrics: new Set(),
    });
    
    const { getByText } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );
    
    expect(getByText('Loading your health data...')).toBeTruthy();
  });
  
  test('renders error view when there is a fetch error', () => {
    const mockError = new Error('Failed to fetch metrics');
    
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: null,
      healthMetrics: null,
      loading: false,
      error: mockError,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: jest.fn(),
      availableMetrics: new Set(),
    });
    
    const { getByTestId } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );
    
    expect(getByTestId('error-view')).toBeTruthy();
    expect(getByTestId('error-message').props.children).toBe('Failed to fetch metrics');
  });
  
  test('renders error view for permission error', () => {
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: null,
      healthMetrics: null,
      loading: false,
      error: null,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: jest.fn(),
      availableMetrics: new Set(),
    });
    
    // Set permission denied
    (useAuth as jest.Mock).mockReturnValue({
      healthPermissionStatus: 'denied',
      requestHealthPermissions: jest.fn().mockResolvedValue('denied'),
    });
    
    const { getByTestId } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );
    
    expect(getByTestId('error-view')).toBeTruthy();
  });
  
  test('renders dashboard with metrics when data is available', () => {
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: mockDailyTotal,
      healthMetrics: mockHealthMetrics,
      loading: false,
      error: null,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: jest.fn(),
      availableMetrics: mockAvailableMetrics,
    });
    
    const { getByTestId, queryByText } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );
    
    // Verify no loading state
    expect(queryByText('Loading your health data...')).toBeNull();
    
    // Verify metrics data is passed to MetricCardList
    expect(getByTestId('metric-card-list')).toBeTruthy();
    expect(getByTestId('metrics-data').props.children).toContain('steps');
  });
  
  test('shows error dialog when errorDialogVisible is true', () => {
    const mockSetErrorDialogVisible = jest.fn();
    
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: mockDailyTotal,
      healthMetrics: mockHealthMetrics,
      loading: false,
      error: null,
      errorDialogVisible: true,
      setErrorDialogVisible: mockSetErrorDialogVisible,
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: jest.fn(),
      availableMetrics: mockAvailableMetrics,
    });
    
    const { getByTestId } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );
    
    // Verify error dialog is rendered
    expect(getByTestId('portal')).toBeTruthy();
    expect(getByTestId('dialog-title')).toBeTruthy();
  });
  
  test('dismisses error dialog when OK button is pressed', () => {
    const mockSetErrorDialogVisible = jest.fn();
    
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: mockDailyTotal,
      healthMetrics: mockHealthMetrics,
      loading: false,
      error: null,
      errorDialogVisible: true,
      setErrorDialogVisible: mockSetErrorDialogVisible,
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: jest.fn(),
      availableMetrics: mockAvailableMetrics,
    });
    
    render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );
    
    // Verify dialog dismiss function
    expect(mockDialogDismiss).not.toBeNull();
    if (mockDialogDismiss) {
      mockDialogDismiss();
      expect(mockSetErrorDialogVisible).toHaveBeenCalledWith(false);
    }
  });
  
  test('calls refreshData when pull-to-refresh is triggered', () => {
    const mockRefreshData = jest.fn();
    
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: mockDailyTotal,
      healthMetrics: mockHealthMetrics,
      loading: false,
      error: null,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: mockRefreshData,
      handleRetry: jest.fn(),
      availableMetrics: mockAvailableMetrics,
    });
    
    const { UNSAFE_getByType } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );
    
    // Simulate refresh control callback
    const refreshControl = UNSAFE_getByType(RefreshControl);
    fireEvent(refreshControl, 'refresh');
    
    expect(mockRefreshData).toHaveBeenCalled();
  });
  
  test('calls retryHandler when retry button is clicked on error view', async () => {
    const mockError = new Error('Failed to fetch metrics');
    const mockHandleRetry = jest.fn();
    
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: null,
      healthMetrics: null,
      loading: false,
      error: mockError,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: mockHandleRetry,
      availableMetrics: new Set(),
    });
    
    const { getByTestId } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );
    
    const retryButton = getByTestId('retry-button');
    fireEvent.press(retryButton);
    
    expect(mockHandleRetry).toHaveBeenCalled();
  });
  
  test('calls requestHealthPermissions for permission errors', async () => {
    const mockRequestHealthPermissions = jest.fn().mockResolvedValue('granted');
    const mockHandleRetry = jest.fn();
    const mockError = new HealthProviderPermissionError('Health permissions denied');
    
    (useAuth as jest.Mock).mockReturnValue({
      healthPermissionStatus: 'not_determined',
      requestHealthPermissions: mockRequestHealthPermissions,
    });
    
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: null,
      healthMetrics: null,
      loading: false,
      error: mockError,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: mockHandleRetry,
      availableMetrics: new Set(),
    });
    
    const { getByTestId } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );
    
    const retryButton = getByTestId('retry-button');
    
    // Using act to handle async state updates
    await act(async () => {
      fireEvent.press(retryButton);
    });
    
    expect(mockRequestHealthPermissions).toHaveBeenCalled();
    // handleRetry should be called after permission is granted
    expect(mockHandleRetry).toHaveBeenCalled();
  });
  
  test('does not retry when permission request is denied', async () => {
    const mockRequestHealthPermissions = jest.fn().mockResolvedValue('denied');
    const mockHandleRetry = jest.fn();
    const mockError = new HealthProviderPermissionError('Health permissions denied');
    
    (useAuth as jest.Mock).mockReturnValue({
      healthPermissionStatus: 'not_determined',
      requestHealthPermissions: mockRequestHealthPermissions,
    });
    
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: null,
      healthMetrics: null,
      loading: false,
      error: mockError,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: mockHandleRetry,
      availableMetrics: new Set(),
    });
    
    const { getByTestId } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );
    
    const retryButton = getByTestId('retry-button');
    
    // Using act to handle async state updates
    await act(async () => {
      fireEvent.press(retryButton);
    });
    
    expect(mockRequestHealthPermissions).toHaveBeenCalled();
    // handleRetry should NOT be called if permission is denied
    expect(mockHandleRetry).not.toHaveBeenCalled();
  });
  
  test('does not render data when healthMetrics is null', () => {
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: mockDailyTotal,
      healthMetrics: null,
      loading: false,
      error: null,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: jest.fn(),
      availableMetrics: new Set(),
    });
    
    const { queryByTestId, getByTestId } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );
    
    // Should show error view instead of metrics
    expect(queryByTestId('metric-card-list')).toBeNull();
    expect(getByTestId('error-view')).toBeTruthy();
  });

  test('shows loading state when no data is available but not in error', () => {
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: null,
      healthMetrics: null,
      loading: false,
      error: null,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: jest.fn(),
      availableMetrics: new Set(),
    });

    const { getByText } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );

    expect(getByText('Loading your health data...')).toBeTruthy();
  });

  test('shows error when healthMetrics is null but dailyTotal exists', () => {
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: mockDailyTotal,
      healthMetrics: null,
      loading: false,
      error: null,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: jest.fn(),
      availableMetrics: new Set(),
    });

    const { getByTestId } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );

    expect(getByTestId('error-message').props.children).toBe('Failed to load health metrics');
  });

  test('shows error when dailyTotal is null but healthMetrics exists', () => {
    (useDashboardData as jest.Mock).mockReturnValue({
      dailyTotal: null,
      healthMetrics: mockHealthMetrics,
      loading: false,
      error: null,
      errorDialogVisible: false,
      setErrorDialogVisible: jest.fn(),
      isRefreshing: false,
      refreshData: jest.fn(),
      handleRetry: jest.fn(),
      availableMetrics: mockAvailableMetrics,
    });

    const { getByTestId } = render(
      <Dashboard provider={mockProvider} userId={mockUserId} />
    );

    expect(getByTestId('error-message').props.children).toBe('Failed to load health metrics');
  });
});