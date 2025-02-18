import '@testing-library/jest-native/extend-expect';
import 'react-native-gesture-handler/jestSetup';

// Load test environment variables
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock Expo Router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSegments: () => [],
  usePathname: () => '/',
  Stack: {
    Screen: jest.fn(),
  },
}));

// Mock Reanimated
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  SlideInRight: {
    duration: 500,
    springify: jest.fn(),
  },
}));

// Mock modules
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(),
  useAuthRequest: jest.fn(),
  exchangeCodeAsync: jest.fn(),
}));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-constants', () => ({}));
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

// Mock React Native
jest.mock('react-native', () => require('@/src/__mocks__/reactNative').default);

// Mock React Native Paper
jest.mock('react-native-paper', () => require('@/src/__mocks__/reactNativePaper').default);

// Global fetch mock with error handling
global.fetch = jest.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers(),
    status: 200,
    statusText: 'OK',
  })
);

// Test lifecycle hooks
beforeAll(() => {
  console.log('\n🚀 Starting test suite...');
});

// Track test suite timing
let suiteStartTime: number;

afterAll((testResults: any) => {
  const suiteEndTime = Date.now();
  const duration = ((suiteEndTime - suiteStartTime) / 1000).toFixed(2);

  if (typeof testResults === 'object') {
    const { numTotalTests, numPassedTests, numFailedTests } = testResults;
    console.log('\n📊 Test Results:');
    console.log(`Total Tests: ${numTotalTests}`);
    console.log(`Passed: ${numPassedTests}`);
    console.log(`Failed: ${numFailedTests}`);
    console.log(`Duration: ${duration}s`);
    
    // Log slow tests warning if applicable
    if (parseFloat(duration) > 60) {
      console.warn('\n⚠️ Warning: Test suite took longer than 1 minute to complete');
    }
  }
});

beforeAll(() => {
  suiteStartTime = Date.now();
  console.log('\n🚀 Starting test suite...');
});

beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset fetch mock
  (global.fetch as jest.Mock).mockReset();
  
  // Reset platform to default
  const { Platform } = require('@/src/__mocks__/reactNative');
  Platform.OS = 'ios';
  
  // Reset Paper theme
  const { resetPaperMocks } = require('@/src/__mocks__/reactNativePaper');
  resetPaperMocks();
});
