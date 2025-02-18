import { render } from '@testing-library/react-native';
import React from 'react';

// Mock health data
export const mockHealthData = {
  steps: 10000,
  distance: 5000,
  calories: 500,
  heartRate: 75,
  activeMinutes: 30,
  sleepHours: 8,
};

// Mock user data
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock auth session
export const mockSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  user: mockUser,
  expires_at: new Date(Date.now() + 3600000).getTime(),
};

// Mock health provider setup
export const setupTestHealthProvider = () => ({
  initialize: jest.fn().mockResolvedValue(true),
  requestPermissions: jest.fn().mockResolvedValue(true),
  isAvailable: jest.fn().mockResolvedValue(true),
  getHealthData: jest.fn().mockResolvedValue(mockHealthData),
  cleanup: jest.fn().mockResolvedValue(undefined),
});

// Mock API response
export const mockApiResponse = {
  data: null,
  error: null,
};

// Wait for async operations
export const waitForAsync = () => new Promise(resolve => setImmediate(resolve)); 