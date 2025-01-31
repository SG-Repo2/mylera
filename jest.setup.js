// Add React Native specific setup
import '@testing-library/jest-native/extend-expect';

// Mock the Expo Router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Stack: {
    Screen: jest.fn(),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock the health providers
jest.mock('react-native-health', () => ({
  AppleHealthKit: {
    initHealthKit: jest.fn(),
    isAvailable: jest.fn(),
    getStepCount: jest.fn(),
    getDistanceWalkingRunning: jest.fn(),
    getActiveEnergyBurned: jest.fn(),
    getBasalEnergyBurned: jest.fn(),
    getHeartRateSamples: jest.fn(),
    getFlightsClimbed: jest.fn(),
    getAppleExerciseTime: jest.fn(),
  },
}));

jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(),
  requestPermission: jest.fn(),
  readRecords: jest.fn(),
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios', // Default to iOS, can be overridden in tests
    select: jest.fn(obj => {
      if (obj.ios) return obj.ios;
      if (obj.android) return obj.android;
      return obj.default;
    }),
    // Helper method to switch platform in tests
    setPlatform: function(platform) {
      this.OS = platform;
    }
  },
  NativeAnimatedHelper: {
    addListener: jest.fn(),
    removeListeners: jest.fn(),
    removeListener: jest.fn(),
    dispatch: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
  StyleSheet: {
    create: jest.fn(styles => styles),
  },
}));

// Global beforeAll/afterAll/beforeEach setup
beforeAll(() => {
  // Any global setup
});

afterAll(() => {
  // Any global cleanup
  jest.clearAllMocks();
});

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});
