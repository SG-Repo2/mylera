import { cleanup } from '@testing-library/react-native';
import { useRouter, usePathname, useSegments } from 'expo-router';
import { afterEach, jest } from '@jest/globals';

// Define router types for better type safety
type RouterContextType = {
  push: jest.Mock;
  replace: jest.Mock;
  back: jest.Mock;
  setParams: jest.Mock;
  pathname: string;
  segments: string[];
  canGoBack: () => boolean;
};

// Enhanced mock router with additional functionality
export const mockRouter: RouterContextType = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  setParams: jest.fn(),
  pathname: '/',
  segments: [],
  canGoBack: jest.fn().mockReturnValue(true) as () => boolean,
};

// Helper to update pathname and segments
export const setMockPathname = (newPathname: string) => {
  mockRouter.pathname = newPathname;
  mockRouter.segments = newPathname.split('/').filter(Boolean);
};

// Reset all router mocks between tests
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  Object.values(mockRouter).forEach(mock => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });
  setMockPathname('/'); // Reset pathname to default
});

// Enhanced expo-router mock
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockRouter.pathname,
  useSegments: () => mockRouter.segments,
  Link: ({ children, ...props }: any) => children,
  Slot: ({ children }: any) => children,
  Stack: {
    Screen: 'Stack.Screen',
  },
  Tabs: {
    Screen: 'Tabs.Screen',
  },
}));

// Helper functions for testing
export const routerHelpers = {
  /**
   * Simulates navigation to a specific route
   */
  navigateTo: (path: string) => {
    setMockPathname(path);
    return mockRouter;
  },

  /**
   * Simulates a back navigation
   */
  goBack: () => {
    mockRouter.back();
    return mockRouter;
  },

  /**
   * Clears navigation history
   */
  resetHistory: () => {
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
    mockRouter.back.mockClear();
  },

  /**
   * Gets navigation history
   */
  getNavigationHistory: () => ({
    push: mockRouter.push.mock.calls,
    replace: mockRouter.replace.mock.calls,
    back: mockRouter.back.mock.calls,
  }),
}; 