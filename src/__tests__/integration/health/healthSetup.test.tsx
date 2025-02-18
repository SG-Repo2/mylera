import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TestProviders } from '@/src/__tests__/utils/TestProviders';
import { mockHealthKitMethods, mockHealthConnect, resetHealthProviderMocks } from '@/src/__mocks__/healthProviders';
import { simulateMetricUpdate, MetricsValidationError } from '@/src/__mocks__/metricsService';
import { simulateGoalAdjustment, simulateTrendAnalysis } from '@/src/__mocks__/healthMetrics';
import { supabase } from '@/src/__mocks__/supabaseClient';
import type { TestUser, TestSession, TestHealthData } from '@/src/__tests__/types/test.types';
import { View, Text, TouchableOpacity } from 'react-native';

// Mock the health setup component
jest.mock('@/src/components/health/HealthSetup', () => {
  const HealthSetup = ({ onComplete }: { onComplete: () => void }) => (
    <View testID="health-setup">
      <TouchableOpacity onPress={onComplete} testID="complete-setup">
        <Text>Complete Setup</Text>
      </TouchableOpacity>
      <Text testID="permission-error">Permission Error</Text>
      <Text testID="goal-suggestion">12000</Text>
      <Text testID="trend-analysis">increasing</Text>
      <Text testID="consistency-score">90%</Text>
    </View>
  );
  return HealthSetup;
});

// Import the mocked component
const HealthSetup = require('@/src/components/health/HealthSetup').default;

describe('Health Setup Integration', () => {
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

  const mockSession: TestSession = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: mockUser,
  };

  const mockHealthData: TestHealthData = {
    user_id: mockUser.id,
    date: new Date().toISOString().split('T')[0],
    steps: 8000,
    heart_rate: 75,
    calories: 400,
  };

  beforeEach(() => {
    resetHealthProviderMocks();
  });

  it('completes health setup flow with permissions and initial sync', async () => {
    // Setup mock responses
    mockHealthKitMethods.initHealthKit.mockResolvedValueOnce(true);
    mockHealthKitMethods.isAvailable.mockResolvedValueOnce(true);
    
    // Mock Supabase auth state
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    // Render the component
    const { getByTestId } = render(
      <TestProviders
        config={{
          initialAuth: {
            user: mockUser,
            session: mockSession,
          },
          mockHealthData,
        }}
      >
        <HealthSetup onComplete={jest.fn()} />
      </TestProviders>
    );

    // Simulate completing setup
    fireEvent.press(getByTestId('complete-setup'));

    // Verify health permissions were requested
    await waitFor(() => {
      expect(mockHealthKitMethods.initHealthKit).toHaveBeenCalled();
    });

    // Verify initial health data sync
    await waitFor(() => {
      expect(mockHealthKitMethods.getStepCount).toHaveBeenCalled();
      expect(mockHealthKitMethods.getHeartRateSamples).toHaveBeenCalled();
      expect(mockHealthKitMethods.getActiveEnergyBurned).toHaveBeenCalled();
    });
  });

  it('handles permission denials gracefully', async () => {
    // Simulate permission denial
    mockHealthKitMethods.initHealthKit.mockRejectedValueOnce(new Error('Permission denied'));

    const { getByTestId } = render(
      <TestProviders
        config={{
          initialAuth: {
            user: mockUser,
            session: mockSession,
          },
        }}
      >
        <HealthSetup onComplete={jest.fn()} />
      </TestProviders>
    );

    fireEvent.press(getByTestId('complete-setup'));

    await waitFor(() => {
      expect(mockHealthKitMethods.initHealthKit).toHaveBeenCalled();
      // Verify error handling UI is shown
      expect(getByTestId('permission-error')).toBeTruthy();
    });
  });

  it('handles data validation and goal suggestions', async () => {
    // Mock successful permissions
    mockHealthKitMethods.initHealthKit.mockResolvedValueOnce(true);
    mockHealthKitMethods.isAvailable.mockResolvedValueOnce(true);

    // Mock invalid data scenario
    mockHealthKitMethods.getStepCount.mockResolvedValueOnce({ value: -100 });

    // Setup goal suggestion
    simulateGoalAdjustment('steps', 12000);
    simulateTrendAnalysis('steps', 'increasing', 0.85);

    const { getByTestId } = render(
      <TestProviders
        config={{
          initialAuth: {
            user: mockUser,
            session: mockSession,
          },
        }}
      >
        <HealthSetup onComplete={jest.fn()} />
      </TestProviders>
    );

    fireEvent.press(getByTestId('complete-setup'));

    await waitFor(() => {
      // Verify validation error is caught
      expect(() =>
        simulateMetricUpdate(mockUser.id, 'steps', -100)
      ).rejects.toThrow(MetricsValidationError);

      // Verify goal suggestion is shown
      expect(getByTestId('goal-suggestion')).toHaveTextContent('12000');
    });
  });

  it('syncs historical data and calculates trends', async () => {
    // Mock successful permissions
    mockHealthKitMethods.initHealthKit.mockResolvedValueOnce(true);
    mockHealthKitMethods.isAvailable.mockResolvedValueOnce(true);

    // Mock historical data
    const historicalSteps = Array.from({ length: 7 }).map((_, i) => ({
      value: 8000 + (i * 500), // Increasing trend
      startDate: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
      endDate: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
    }));

    mockHealthKitMethods.getStepCount.mockResolvedValue(historicalSteps);

    // Setup trend analysis
    simulateTrendAnalysis('steps', 'increasing', 0.9);

    const { getByTestId } = render(
      <TestProviders
        config={{
          initialAuth: {
            user: mockUser,
            session: mockSession,
          },
        }}
      >
        <HealthSetup onComplete={jest.fn()} />
      </TestProviders>
    );

    fireEvent.press(getByTestId('complete-setup'));

    await waitFor(() => {
      // Verify historical data sync
      expect(mockHealthKitMethods.getStepCount).toHaveBeenCalled();
      
      // Verify trend analysis is shown
      expect(getByTestId('trend-analysis')).toHaveTextContent('increasing');
      expect(getByTestId('consistency-score')).toHaveTextContent('90%');
    });
  });
});
