import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Dashboard } from '@/src/components/metrics/Dashboard';
import { useHealthData } from '@/src/hooks/useHealthData';
import { metricsService } from '@/src/services/metricsService';
import { leaderboardService } from '@/src/services/leaderboardService';
import { mockHealthData } from '../utils/testHelpers';

// Mock hooks and services
jest.mock('@/src/hooks/useHealthData');
jest.mock('@/src/services/metricsService');
jest.mock('@/src/services/leaderboardService');

describe('Dashboard', () => {
  const mockUserId = 'test-user-123';
  const mockDate = '2024-02-18';

  const mockProvider = {
    initialize: jest.fn(),
    getMetrics: jest.fn().mockResolvedValue(mockHealthData),
    checkPermissionsStatus: jest.fn().mockResolvedValue({ status: 'granted' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useHealthData hook
    (useHealthData as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      syncHealthData: jest.fn(),
      isInitialized: true,
      provider: mockProvider,
    });

    // Mock metrics service
    (metricsService.getDailyTotals as jest.Mock).mockResolvedValue([
      {
        id: 'total-1',
        user_id: mockUserId,
        total_points: 100,
        metrics_completed: 5,
      },
    ]);

    (metricsService.getDailyMetrics as jest.Mock).mockResolvedValue([
      {
        id: 'metric-1',
        user_id: mockUserId,
        metric_type: 'steps',
        value: 10000,
        points: 50,
      },
    ]);

    // Mock leaderboard service
    (leaderboardService.getUserRank as jest.Mock).mockResolvedValue(1);
  });

  it('renders loading state initially', () => {
    (useHealthData as jest.Mock).mockReturnValue({
      loading: true,
      error: null,
      syncHealthData: jest.fn(),
      isInitialized: false,
      provider: null,
    });

    const { getByText } = render(<Dashboard userId={mockUserId} />);
    expect(getByText('Loading your health data...')).toBeTruthy();
  });

  it('renders error state when health data fails', () => {
    (useHealthData as jest.Mock).mockReturnValue({
      loading: false,
      error: new Error('Failed to load health data'),
      syncHealthData: jest.fn(),
      isInitialized: true,
      provider: null,
    });

    const { getByText } = render(<Dashboard userId={mockUserId} />);
    expect(getByText('Failed to load health data')).toBeTruthy();
  });

  it('renders dashboard with health metrics', async () => {
    const { getByText, queryByText } = render(<Dashboard userId={mockUserId} date={mockDate} />);

    await waitFor(() => {
      expect(queryByText('Loading your health data...')).toBeNull();
      expect(getByText('100 pts')).toBeTruthy();
    });
  });

  it('handles refresh action', async () => {
    const mockSyncHealthData = jest.fn();
    (useHealthData as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      syncHealthData: mockSyncHealthData,
      isInitialized: true,
      provider: mockProvider,
    });

    const { getByTestId } = render(<Dashboard userId={mockUserId} />);

    await act(async () => {
      fireEvent(getByTestId('refresh-control'), 'refresh');
    });

    expect(mockSyncHealthData).toHaveBeenCalled();
  });

  it('handles metric fetch errors gracefully', async () => {
    // Mock metrics service error
    (metricsService.getDailyMetrics as jest.Mock).mockRejectedValue(
      new Error('Failed to fetch metrics')
    );

    const { getByText } = render(<Dashboard userId={mockUserId} />);

    await waitFor(() => {
      expect(getByText('Failed to fetch health metrics. Please try again.')).toBeTruthy();
    });
  });

  it('updates metrics when health data changes', async () => {
    const { rerender, getByText } = render(<Dashboard userId={mockUserId} />);

    // Update mock health data
    const updatedHealthData = {
      ...mockHealthData,
      steps: 15000,
      daily_score: 150,
    };
    mockProvider.getMetrics.mockResolvedValue(updatedHealthData);

    // Trigger a re-render
    await act(async () => {
      rerender(<Dashboard userId={mockUserId} />);
    });

    await waitFor(() => {
      expect(metricsService.updateMetric).toHaveBeenCalledWith(
        mockUserId,
        'steps',
        updatedHealthData.steps
      );
    });
  });

  it('handles permission denied state', () => {
    (useHealthData as jest.Mock).mockReturnValue({
      loading: false,
      error: new Error('Health permissions denied'),
      syncHealthData: jest.fn(),
      isInitialized: true,
      provider: null,
    });

    const { getByText, getByTestId } = render(<Dashboard userId={mockUserId} />);
    
    const retryButton = getByTestId('retry-button');
    fireEvent.press(retryButton);

    expect(getByText('Health permissions denied')).toBeTruthy();
  });

  it('displays alerts when enabled', async () => {
    const { getByTestId } = render(<Dashboard userId={mockUserId} showAlerts={true} />);

    await waitFor(() => {
      expect(getByTestId('metric-alerts')).toBeTruthy();
    });
  });

  it('hides alerts when disabled', async () => {
    const { queryByTestId } = render(<Dashboard userId={mockUserId} showAlerts={false} />);

    await waitFor(() => {
      expect(queryByTestId('metric-alerts')).toBeNull();
    });
  });
}); 