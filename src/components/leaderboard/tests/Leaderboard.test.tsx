import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';

// Type for our mocked AppState
interface MockAppState extends Omit<typeof AppState, 'addEventListener'> {
  emit: (event: string, ...args: any[]) => void;
  addEventListener: (
    type: string,
    handler: (state: AppStateStatus) => void
  ) => { remove: () => void };
}

import { Leaderboard } from '../Leaderboard';
import { mockLeaderboardService, setupSuccessScenario, setupErrorScenario, resetMocks } from './mocks/leaderboardService';
import { mockLeaderboardEntries, mockErrors, TEST_DATE } from './mocks/leaderboardData';

// Mock variables must be defined before jest.mock calls
const mockCurrentUserId = 'user-1';

// Mock the AuthProvider context
jest.mock('../../../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: mockCurrentUserId },
  }),
}));

const mockDate = '2025-01-31';
const mockDisplayDate = 'January 31, 2025';

// Mock DateUtils to return consistent date for tests
jest.mock('../../../utils/DateUtils', () => ({
  DateUtils: {
    getLocalDateString: () => mockDate,
    formatDateForDisplay: () => mockDisplayDate,
  },
}));

describe('Leaderboard', () => {
  beforeEach(() => {
    resetMocks();
  });

  // Core Functionality Tests
  describe('Loading State', () => {
    it('displays loading indicator when fetching data', () => {
      // Setup a pending promise to keep the loading state
      mockLeaderboardService.getDailyLeaderboard.mockImplementation(
        () => new Promise(() => {})
      );

      const { getByTestId } = render(<Leaderboard />);
      expect(getByTestId('leaderboard-loading')).toBeTruthy();
    });
  });

  describe('Success State', () => {
    beforeEach(() => {
      setupSuccessScenario();
    });

    it('renders header with correct date', async () => {
      const { getByText } = render(<Leaderboard />);
      
      await waitFor(() => {
        expect(getByText('Daily Leaderboard')).toBeTruthy();
        expect(getByText('January 31, 2025')).toBeTruthy();
      });
    });

    it('displays summary card with total participants', async () => {
      const { getByText } = render(<Leaderboard />);
      
      await waitFor(() => {
        expect(getByText('Total Participants')).toBeTruthy();
        expect(getByText(String(mockLeaderboardEntries.length))).toBeTruthy();
      });
    });

    it('renders all leaderboard entries in correct order', async () => {
      const { getAllByRole } = render(<Leaderboard />);
      
      await waitFor(() => {
        const entries = getAllByRole('text');
        expect(entries).toHaveLength(mockLeaderboardEntries.length);
        
        // Verify first entry details
        expect(entries[0]).toHaveTextContent(mockLeaderboardEntries[0].display_name);
        expect(entries[0]).toHaveTextContent(String(mockLeaderboardEntries[0].total_points));
      });
    });

    it('highlights current user entry', async () => {
      const { getAllByRole } = render(<Leaderboard />);
      
      await waitFor(() => {
        const entries = getAllByRole('text');
        const currentUserEntry = entries.find(entry => 
          entry.props.accessibilityHint === "This is your position on the leaderboard"
        );
        expect(currentUserEntry).toBeTruthy();
      });
    });
  });

  describe('Error States', () => {
    it('shows unavailable message for PGRST200 error', async () => {
      setupErrorScenario('unavailable');
      
      const { getByText, getByTestId } = render(<Leaderboard />);
      
      await waitFor(() => {
        expect(getByTestId('error-view')).toBeTruthy();
        expect(getByText(/temporarily unavailable/i)).toBeTruthy();
      });
    });

    it('shows permission denied message for 42501 error', async () => {
      setupErrorScenario('permissionDenied');
      
      const { getByText, getByTestId } = render(<Leaderboard />);
      
      await waitFor(() => {
        expect(getByTestId('error-view')).toBeTruthy();
        expect(getByText(/do not have permission/i)).toBeTruthy();
      });
    });

    it('shows generic error message for network errors', async () => {
      setupErrorScenario('network');
      
      const { getByText, getByTestId } = render(<Leaderboard />);
      
      await waitFor(() => {
        expect(getByTestId('error-view')).toBeTruthy();
        expect(getByText(/failed to load leaderboard/i)).toBeTruthy();
      });
    });
  });

  describe('Empty State', () => {
    it('displays empty state message when no data is available', async () => {
      setupErrorScenario('empty');
      
      const { getByText } = render(<Leaderboard />);
      
      await waitFor(() => {
        expect(getByText(/no leaderboard data available/i)).toBeTruthy();
      });
    });
  });

  describe('AppState Integration', () => {
    it('refreshes data when app comes to foreground', async () => {
      setupSuccessScenario();
      
      render(<Leaderboard />);
      
      await waitFor(() => {
        expect(mockLeaderboardService.getDailyLeaderboard).toHaveBeenCalledTimes(1);
      });

      // Simulate app going to background then foreground
      act(() => {
        (AppState as unknown as MockAppState).emit('change', 'background');
        (AppState as unknown as MockAppState).emit('change', 'active');
      });

      // Should trigger another data fetch
      expect(mockLeaderboardService.getDailyLeaderboard).toHaveBeenCalledTimes(2);
    });
  });

  // Snapshot test
  it('matches snapshot in success state', async () => {
    setupSuccessScenario();
    
    const { toJSON } = render(<Leaderboard />);
    
    await waitFor(() => {
      expect(mockLeaderboardService.getDailyLeaderboard).toHaveBeenCalled();
    });
    
    expect(toJSON()).toMatchSnapshot();
  });
});
