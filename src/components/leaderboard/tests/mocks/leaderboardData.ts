import { LeaderboardEntry, DailyTotal, UserProfile } from '../../../../types/leaderboard';

// Fixed test data constants
export const TEST_DATE = '2025-01-31';
export const CURRENT_USER_ID = 'user-1';
export const TIMESTAMP = '2025-01-31T12:00:00Z';

// Mock user profiles with consistent data
export const mockUserProfiles: Record<string, UserProfile> = {
  currentUser: {
    id: CURRENT_USER_ID,
    display_name: 'Current User',
    avatar_url: 'https://example.com/current-user-avatar.jpg',
    show_profile: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  },
  withAvatar: {
    id: 'user-2',
    display_name: 'Alice Smith',
    avatar_url: 'https://example.com/alice-avatar.jpg',
    show_profile: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  },
  withoutAvatar: {
    id: 'user-3',
    display_name: 'Bob Johnson',
    avatar_url: null,
    show_profile: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  },
  hidden: {
    id: 'user-4',
    display_name: 'Hidden User',
    avatar_url: null,
    show_profile: false,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  },
};

// Mock daily totals with consistent point values
export const mockDailyTotals: DailyTotal[] = [
  {
    id: 'daily-1',
    user_id: mockUserProfiles.withAvatar.id,
    date: TEST_DATE,
    total_points: 200,
    metrics_completed: 3,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    user_profiles: mockUserProfiles.withAvatar,
  },
  {
    id: 'daily-2',
    user_id: mockUserProfiles.currentUser.id,
    date: TEST_DATE,
    total_points: 150,
    metrics_completed: 2,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    user_profiles: mockUserProfiles.currentUser,
  },
  {
    id: 'daily-3',
    user_id: mockUserProfiles.withoutAvatar.id,
    date: TEST_DATE,
    total_points: 100,
    metrics_completed: 1,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    user_profiles: mockUserProfiles.withoutAvatar,
  },
  {
    id: 'daily-4',
    user_id: mockUserProfiles.hidden.id,
    date: TEST_DATE,
    total_points: 175,
    metrics_completed: 2,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    user_profiles: mockUserProfiles.hidden,
  },
];

// Processed leaderboard entries (after filtering and ranking)
export const mockLeaderboardEntries: LeaderboardEntry[] = [
  {
    user_id: mockUserProfiles.withAvatar.id,
    display_name: mockUserProfiles.withAvatar.display_name || 'Anonymous User',
    avatar_url: mockUserProfiles.withAvatar.avatar_url,
    total_points: 200,
    metrics_completed: 3,
    rank: 1,
  },
  {
    user_id: mockUserProfiles.currentUser.id,
    display_name: mockUserProfiles.currentUser.display_name || 'Anonymous User',
    avatar_url: mockUserProfiles.currentUser.avatar_url,
    total_points: 150,
    metrics_completed: 2,
    rank: 2,
  },
  {
    user_id: mockUserProfiles.withoutAvatar.id,
    display_name: mockUserProfiles.withoutAvatar.display_name || 'Anonymous User',
    avatar_url: null,
    total_points: 100,
    metrics_completed: 1,
    rank: 3,
  },
];

// Mock error responses
export const mockErrors = {
  unavailable: new Error('PGRST200: Leaderboard data is temporarily unavailable'),
  permissionDenied: new Error('42501: You do not have permission to view the leaderboard'),
  network: new Error('Network request failed'),
};

// Mock response data for different scenarios
export const mockResponses = {
  success: {
    data: mockDailyTotals,
    error: null,
  },
  empty: {
    data: [],
    error: null,
  },
  unavailable: {
    data: null,
    error: mockErrors.unavailable,
  },
  permissionDenied: {
    data: null,
    error: mockErrors.permissionDenied,
  },
  network: {
    data: null,
    error: mockErrors.network,
  },
};
