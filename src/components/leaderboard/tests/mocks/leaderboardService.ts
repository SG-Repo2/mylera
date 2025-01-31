import { leaderboardService } from '../../../../services/leaderboardService';
import { mockResponses, mockLeaderboardEntries, TEST_DATE } from './leaderboardData';

// Mock implementation of the leaderboard service
export const mockLeaderboardService = {
  getDailyLeaderboard: jest.fn(),
  subscribeToLeaderboard: jest.fn(),
  getUserRank: jest.fn(),
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
};

// Helper to set up success scenario
export const setupSuccessScenario = () => {
  mockLeaderboardService.getDailyLeaderboard.mockResolvedValue(mockLeaderboardEntries);
  mockLeaderboardService.subscribeToLeaderboard.mockImplementation((date, callback) => {
    // Return a mock subscription object that matches Supabase's RealtimeChannel interface
    return {
      subscribe: jest.fn(() => ({
        unsubscribe: jest.fn(),
      })),
    };
  });
};

// Helper to set up error scenarios
export const setupErrorScenario = (errorType: keyof typeof mockResponses) => {
  if (mockResponses[errorType].error) {
    mockLeaderboardService.getDailyLeaderboard.mockRejectedValue(mockResponses[errorType].error);
  } else {
    mockLeaderboardService.getDailyLeaderboard.mockResolvedValue(mockResponses[errorType].data);
  }
};

// Helper to simulate real-time updates
export const simulateRealtimeUpdate = (callback: (entries: typeof mockLeaderboardEntries) => void) => {
  const updatedEntries = [...mockLeaderboardEntries];
  // Simulate a point change for the first user
  updatedEntries[0] = {
    ...updatedEntries[0],
    total_points: updatedEntries[0].total_points + 50,
  };
  callback(updatedEntries);
};

// Helper to reset all mocks
export const resetMocks = () => {
  mockLeaderboardService.getDailyLeaderboard.mockReset();
  mockLeaderboardService.subscribeToLeaderboard.mockReset();
  mockLeaderboardService.getUserRank.mockReset();
  mockLeaderboardService.getUserProfile.mockReset();
  mockLeaderboardService.updateUserProfile.mockReset();
};

// Mock the entire leaderboard service module
jest.mock('../../../../services/leaderboardService', () => ({
  leaderboardService: mockLeaderboardService,
}));
