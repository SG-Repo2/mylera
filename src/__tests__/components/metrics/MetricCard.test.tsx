import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MetricCard } from '@/src/components/metrics/MetricCard';
import { healthMetrics, simulateGoalAdjustment, simulateTrendAnalysis } from '@/src/__mocks__/healthMetrics';
import { simulateMetricUpdate, MetricsValidationError } from '@/src/__mocks__/metricsService';
import type { TestUser } from '@/src/__tests__/types/test.types';
import { TestProviders } from '@/src/__tests__/utils/TestProviders';

describe('MetricCard Component', () => {
  const mockUser: TestUser = {
    id: 'test-user',
    email: 'test@example.com',
    user_metadata: {
      displayName: 'Test User',
      deviceType: 'ios',
      measurementSystem: 'metric',
    },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    role: 'authenticated',
  };

  const defaultProps = {
    metricType: 'steps' as const,
    value: 8000,
    goal: 10000,
    title: 'Steps',
    points: 100,
    icon: 'timer' as const,
    unit: 'steps',
    onPress: jest.fn(),
    onUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders metric information correctly', () => {
    const { getByTestId, getByText } = render(
      <TestProviders>
        <MetricCard {...defaultProps} />
      </TestProviders>
    );

    expect(getByTestId('metric-icon')).toBeTruthy();
    expect(getByText('Steps')).toBeTruthy();
    expect(getByText('8,000')).toBeTruthy();
    expect(getByTestId('progress-indicator')).toBeTruthy();
  });

  it('displays progress and goal information', () => {
    const { getByTestId } = render(
      <TestProviders>
        <MetricCard {...defaultProps} />
      </TestProviders>
    );

    const progressBar = getByTestId('progress-bar');
    expect(progressBar.props.progress).toBe(0.8); // 8000/10000
    expect(getByTestId('goal-text')).toHaveTextContent('Goal: 10,000');
  });

  it('handles goal adjustments', async () => {
    simulateGoalAdjustment('steps', 12000);
    simulateTrendAnalysis('steps', 'increasing', 0.9);

    const { getByTestId, getByText } = render(
      <TestProviders>
        <MetricCard {...defaultProps} />
      </TestProviders>
    );

    // Open goal adjustment modal
    fireEvent.press(getByTestId('adjust-goal-button'));

    await waitFor(() => {
      expect(getByTestId('suggested-goal')).toHaveTextContent('12,000');
      expect(getByTestId('trend-indicator')).toHaveTextContent('increasing');
      expect(getByTestId('consistency-score')).toHaveTextContent('90%');
    });

    // Accept suggested goal
    fireEvent.press(getByTestId('accept-goal'));

    await waitFor(() => {
      expect(defaultProps.onUpdate).toHaveBeenCalledWith({
        type: 'steps',
        goal: 12000,
      });
    });
  });

  it('validates metric updates', async () => {
    const { getByTestId } = render(
      <TestProviders
        config={{
          initialAuth: {
            user: mockUser,
            session: { user: mockUser, access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'Bearer' },
          },
        }}
      >
        <MetricCard {...defaultProps} />
      </TestProviders>
    );

    // Try to update with invalid value
    fireEvent.press(getByTestId('edit-value-button'));
    fireEvent.changeText(getByTestId('value-input'), '-100');
    fireEvent.press(getByTestId('save-value-button'));

    await waitFor(() => {
      expect(() =>
        simulateMetricUpdate(mockUser.id, 'steps', -100)
      ).rejects.toThrow(MetricsValidationError);
      expect(getByTestId('validation-error')).toBeTruthy();
    });
  });

  it('displays achievement celebrations', async () => {
    const { getByTestId, queryByTestId } = render(
      <TestProviders>
        <MetricCard
          {...defaultProps}
          value={10000} // Equal to goal
          goal={10000}
        />
      </TestProviders>
    );

    expect(getByTestId('celebration-animation')).toBeTruthy();
    expect(getByTestId('achievement-message')).toHaveTextContent('Goal Reached!');

    // Celebration should disappear after animation
    await waitFor(() => {
      expect(queryByTestId('celebration-animation')).toBeNull();
    }, { timeout: 3000 });
  });

  it('handles different measurement systems', () => {
    const { rerender, getByText } = render(
      <TestProviders>
        <MetricCard
          {...defaultProps}
          metricType="distance"
          value={5000}
          goal={10000}
          unit="km"
          title="Distance"
        />
      </TestProviders>
    );

    // Default metric system
    expect(getByText('5.0 km')).toBeTruthy();

    // Switch to imperial
    rerender(
      <TestProviders
        config={{
          initialAuth: {
            user: {
              ...mockUser,
              user_metadata: {
                ...mockUser.user_metadata,
                measurementSystem: 'imperial',
              },
            },
            session: { user: mockUser, access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'Bearer' },
          },
        }}
      >
        <MetricCard
          {...defaultProps}
          metricType="distance"
          value={5000}
          goal={10000}
          unit="mi"
          title="Distance"
        />
      </TestProviders>
    );

    expect(getByText('3.1 mi')).toBeTruthy();
  });

  it('updates progress animation smoothly', async () => {
    const { rerender, getByTestId } = render(
      <TestProviders>
        <MetricCard {...defaultProps} value={5000} />
      </TestProviders>
    );

    const initialProgress = getByTestId('progress-bar').props.progress;
    
    // Update to higher value
    rerender(
      <TestProviders>
        <MetricCard {...defaultProps} value={7500} />
      </TestProviders>
    );

    // Check for animation
    await waitFor(() => {
      const newProgress = getByTestId('progress-bar').props.progress;
      expect(newProgress).toBeGreaterThan(initialProgress);
      expect(newProgress).toBe(0.75);
    });
  });
});
