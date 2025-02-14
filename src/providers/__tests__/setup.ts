import '@testing-library/jest-native/extend-expect';
import { jest } from '@jest/globals';

// Mock Platform.select
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: (obj: { ios: any; android: any }) => obj.ios,
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock expo-router
const mockRouter = {
  push: jest.fn().mockImplementation(() => Promise.resolve()),
  replace: jest.fn().mockImplementation(() => Promise.resolve()),
  back: jest.fn().mockImplementation(() => Promise.resolve()),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn((callback: () => (() => void) | undefined) => {
    callback();
    return jest.fn();
  }),
}));

// Export mock router for tests
export { mockRouter };

// Mock BackHandler
jest.mock('react-native/Libraries/Utilities/BackHandler', () => ({
  addEventListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  removeEventListener: jest.fn(),
}));

// Mock react-native-paper components
jest.mock('react-native-paper', () => ({
  Button: function Button({ children, onPress, mode = 'text', testID }: any) {
    const text = typeof children === 'string' ? children : '';
    return {
      $$typeof: Symbol.for('react.element'),
      type: 'View',
      ref: null,
      props: { 
        role: 'button',
        children: text,
        onPress, 
        mode, 
        testID,
        accessibilityLabel: text,
        accessibilityRole: 'button',
        accessible: true
      }
    };
  },
  TextInput: function TextInput({ placeholder, value, onChangeText, testID }: any) {
    return {
      $$typeof: Symbol.for('react.element'),
      type: 'TextInput',
      ref: null,
      props: { 
        placeholder, 
        value, 
        onChangeText, 
        testID,
        accessibilityRole: 'textbox',
        accessible: true
      }
    };
  },
  Text: function Text({ children, style, testID }: any) {
    const text = typeof children === 'string' ? children : '';
    return {
      $$typeof: Symbol.for('react.element'),
      type: 'Text',
      ref: null,
      props: { 
        children: text, 
        style, 
        testID,
        accessibilityRole: 'text',
        accessible: true
      }
    };
  },
  ActivityIndicator: function ActivityIndicator({ testID }: any) {
    return {
      $$typeof: Symbol.for('react.element'),
      type: 'ActivityIndicator',
      ref: null,
      props: { testID }
    };
  },
  Surface: function Surface({ children, style, testID }: any) {
    return {
      $$typeof: Symbol.for('react.element'),
      type: 'View',
      ref: null,
      props: { 
        role: 'none',
        children, 
        style, 
        testID,
        accessibilityRole: 'none'
      }
    };
  },
  Pressable: function Pressable({ children, onPress, style, testID }: any) {
    return {
      $$typeof: Symbol.for('react.element'),
      type: 'View',
      ref: null,
      props: {
        role: 'button',
        children,
        onPress,
        style,
        testID,
        accessibilityRole: 'button'
      }
    };
  }
}));

type ImagePickerPermissionResponse = {
  status: 'granted';
  granted: boolean;
};

type ImagePickerResult = {
  canceled: boolean;
  assets: Array<{
    uri: string;
    fileSize: number;
    type: string;
    width: number;
    height: number;
  }>;
};

// Mock expo-image-picker
jest.mock('expo-image-picker', () => {
  const mockLaunchImageLibrary = jest.fn(() => 
    Promise.resolve({
      canceled: false,
      assets: [{
        uri: 'test-image-uri',
        fileSize: 1024 * 1024,
        type: 'image',
        width: 100,
        height: 100,
      }]
    })
  );

  const mockRequestPermissions = jest.fn(() => 
    Promise.resolve({
      status: 'granted',
      granted: true
    })
  );

  return {
    launchImageLibraryAsync: mockLaunchImageLibrary,
    MediaTypeOptions: {
      Images: 'Images'
    },
    requestMediaLibraryPermissionsAsync: mockRequestPermissions,
  };
});

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

// Mock theme
jest.mock('../../../src/theme/theme', () => ({
  theme: {
    colors: {
      primary: '#000000',
      surface: '#FFFFFF',
      error: '#FF0000',
    },
    fonts: {
      bodyMedium: {},
      headlineMedium: {},
    },
  },
}));

// Define types for mock responses
interface SupabaseAuthResponse {
  data: { user: { id: string } } | null;
  error: Error | null;
}

interface SupabaseStorageResponse {
  data: { path: string } | null;
  error: Error | null;
}

interface SupabaseDataResponse<T = any> {
  data: T | null;
  error: Error | null;
}

// Mock Supabase client
const mockSupabase = {
  auth: {
    signUp: jest.fn(() => Promise.resolve({
      data: { user: { id: 'test-user-id' } },
      error: null
    })),
    signInWithPassword: jest.fn(() => Promise.resolve({
      data: {
        user: { id: 'test-user-id' },
        session: { user: { id: 'test-user-id' } }
      },
      error: null
    })),
    signOut: jest.fn(() => Promise.resolve({
      error: null
    })),
    getSession: jest.fn(() => Promise.resolve({
      data: { session: null },
      error: null
    })),
    onAuthStateChange: jest.fn((callback) => ({
      data: { subscription: { unsubscribe: jest.fn() } },
      error: null
    })),
  },
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({
        data: { path: 'test/path' },
        error: null
      })),
      remove: jest.fn(() => Promise.resolve({
        data: null,
        error: null
      })),
    })),
  },
  from: jest.fn((table) => {
    if (table === 'user_profiles') {
      return {
        insert: jest.fn().mockImplementation((data) => {
          // Simulate profile creation failure when specified
          if (process.env.MOCK_PROFILE_ERROR) {
            return Promise.resolve({
              data: null,
              error: new Error('Profile creation failed')
            });
          }
          return Promise.resolve({
            data,
            error: null
          });
        }),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: null,
              error: null
            })),
          })),
        })),
      };
    }
    return {
      insert: jest.fn(() => Promise.resolve({
        data: null,
        error: null
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: null,
            error: null
          })),
        })),
      })),
    };
  }),
};

jest.mock('../../../src/services/supabaseClient', () => ({
  supabase: mockSupabase,
}));

// Mock leaderboardService
const mockLeaderboardService = {
  uploadAvatar: jest.fn((_userId: string, _uri: string) =>
    Promise.resolve('test-avatar-url')
  ),
  deleteAvatar: jest.fn((_filePath: string) =>
    Promise.resolve()
  ),
  getFilePathFromUrl: jest.fn((_url: string) =>
    'test-path'
  ),
};

jest.mock('../../../src/services/leaderboardService', () => ({
  leaderboardService: mockLeaderboardService,
}));

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveTextContent: (text: string) => R;
      toBeDisabled: () => R;
      toBeEnabled: () => R;
      toBeEmpty: () => R;
      toHaveStyle: (style: object) => R;
      toBeVisible: () => R;
      toBeOnTheScreen: () => R;
    }
  }
}

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Export mocks for use in tests
export { mockSupabase, mockLeaderboardService };
