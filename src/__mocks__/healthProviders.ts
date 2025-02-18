import { HealthProvider } from '@/src/providers/health/types';

// Health provider types and mocks
interface HealthMetricPermissions {
  steps: boolean;
  distance: boolean;
  calories: boolean;
  heartRate: boolean;
  exercise: boolean;
}

const mockHealthKitPermissionsStatus: HealthMetricPermissions = {
  steps: true,
  distance: true,
  calories: true,
  heartRate: true,
  exercise: true,
};

const mockHealthConnectPermissionsStatus: HealthMetricPermissions = {
  steps: true,
  distance: true,
  calories: true,
  heartRate: true,
  exercise: true,
};

export const mockHealthKitMethods = {
  initHealthKit: jest.fn().mockResolvedValue(true),
  isAvailable: jest.fn().mockResolvedValue(true),
  getStepCount: jest.fn().mockResolvedValue({ value: 8000 }),
  getDistanceWalkingRunning: jest.fn().mockResolvedValue({ value: 5000 }),
  getActiveEnergyBurned: jest.fn().mockResolvedValue({ value: 400 }),
  getBasalEnergyBurned: jest.fn().mockResolvedValue({ value: 1500 }),
  getHeartRateSamples: jest.fn().mockResolvedValue([{ value: 75 }]),
  getFlightsClimbed: jest.fn().mockResolvedValue({ value: 12 }),
  getAppleExerciseTime: jest.fn().mockResolvedValue({ value: 35 }),
  simulatePermissionError: jest.fn((metric: keyof HealthMetricPermissions) => {
    mockHealthKitPermissionsStatus[metric] = false;
    return Promise.reject(new Error(`Permission denied for ${metric}`));
  }),
};

export const mockHealthConnect = {
  initialize: jest.fn().mockResolvedValue(true),
  requestPermission: jest.fn().mockResolvedValue(true),
  readRecords: jest.fn().mockResolvedValue([
    { steps: 8000 },
    { distance: 5000 },
    { calories: 400 },
    { heartRate: 75 },
    { exercise: 35 },
  ]),
  simulatePermissionError: jest.fn((metric: keyof HealthMetricPermissions) => {
    mockHealthConnectPermissionsStatus[metric] = false;
    return Promise.reject(new Error(`Permission denied for ${metric}`));
  }),
};

// Helper to reset all mocks between tests
export const resetHealthProviderMocks = () => {
  Object.values(mockHealthKitMethods).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockClear();
    }
  });
  Object.values(mockHealthConnect).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockClear();
    }
  });
  
  // Reset permission statuses
  Object.keys(mockHealthKitPermissionsStatus).forEach(key => {
    mockHealthKitPermissionsStatus[key as keyof HealthMetricPermissions] = true;
  });
  Object.keys(mockHealthConnectPermissionsStatus).forEach(key => {
    mockHealthConnectPermissionsStatus[key as keyof HealthMetricPermissions] = true;
  });
};

// Mock implementations
jest.mock('react-native-health', () => ({
  AppleHealthKit: mockHealthKitMethods,
}));

jest.mock('react-native-health-connect', () => mockHealthConnect);

export {
  mockHealthKitPermissionsStatus,
  mockHealthConnectPermissionsStatus,
  HealthMetricPermissions,
};
