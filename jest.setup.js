// Add React Native specific setup
import '@testing-library/jest-native/extend-expect';

// Load test environment variables
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock URL polyfill
jest.mock('react-native-url-polyfill/auto', () => {});

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      data: null,
      error: null,
    })),
  })),
}));

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
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');

  // Mock EventEmitter for AppState
  class MockEventEmitter {
    listeners = {};
    addListener = jest.fn((event, callback) => {
      this.listeners[event] = callback;
      return { remove: jest.fn() };
    });
    removeAllListeners = jest.fn();
    emit = jest.fn((event, ...args) => {
      Object.values(this.listeners).forEach(callback => {
        if (typeof callback === 'function') {
          callback(...args);
        }
      });
    });
  }

  // Create mock AppState
  const mockAppState = new MockEventEmitter();
  mockAppState.currentState = 'active';
  mockAppState.addEventListener = jest.fn((event, callback) => {
    mockAppState.addListener(event, callback);
    return {
      remove: jest.fn(),
    };
  });

  const createMockComponent = name => {
    const Component = ({ children, testID, ...props }) => {
      return {
        $$typeof: Symbol.for('react.element'),
        type: name,
        props: { ...props, testID, children },
        ref: null,
      };
    };
    Component.displayName = name;
    return Component;
  };

  return {
    Platform: {
      OS: 'ios',
      select: jest.fn(obj => {
        if (obj.ios) return obj.ios;
        if (obj.android) return obj.android;
        return obj.default;
      }),
      setPlatform: function (platform) {
        this.OS = platform;
      },
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
      flatten: jest.fn(style => style),
    },
    AppState: mockAppState,
    // Add basic components with proper component structure
    View: createMockComponent('View'),
    Text: createMockComponent('Text'),
    TouchableOpacity: createMockComponent('TouchableOpacity'),
    Image: createMockComponent('Image'),
    Animated: {
      View: createMockComponent('Animated.View'),
      Text: createMockComponent('Animated.Text'),
      Value: class AnimatedValue {
        constructor(value) {
          this._value = value;
          this._listeners = [];
        }

        setValue(value) {
          this._value = value;
          this._listeners.forEach(listener => listener({ value }));
        }

        interpolate({ inputRange, outputRange }) {
          return {
            _interpolation: { inputRange, outputRange },
            __getValue: () => {
              const input = this._value;
              const index = inputRange.findIndex(x => x >= input) - 1;
              if (index < 0) return outputRange[0];
              if (index >= inputRange.length - 1) return outputRange[outputRange.length - 1];
              const progress =
                (input - inputRange[index]) / (inputRange[index + 1] - inputRange[index]);
              return outputRange[index] + progress * (outputRange[index + 1] - outputRange[index]);
            },
          };
        }

        addListener(callback) {
          this._listeners.push(callback);
          return { remove: () => this.removeListener(callback) };
        }

        removeListener(callback) {
          const index = this._listeners.indexOf(callback);
          if (index > -1) this._listeners.splice(index, 1);
        }

        __getValue() {
          return this._value;
        }
      },
      timing: jest.fn((value, config) => ({
        start: jest.fn(callback => {
          value.setValue(config.toValue);
          callback && callback({ finished: true });
        }),
      })),
      sequence: jest.fn(animations => ({
        start: jest.fn(callback => {
          animations.forEach(anim => anim.start());
          callback && callback({ finished: true });
        }),
      })),
      parallel: jest.fn(animations => ({
        start: jest.fn(callback => {
          animations.forEach(anim => anim.start());
          callback && callback({ finished: true });
        }),
      })),
    },
  };
});

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

// Mock react-native-paper
jest.mock('react-native-paper', () => ({
  MD3LightTheme: {
    colors: {
      primary: '#6200EE',
      primaryContainer: '#E8DEF8',
      surface: '#FFFFFF',
      surfaceVariant: '#E7E0EC',
      onSurface: '#1C1B1F',
      onSurfaceVariant: '#49454F',
    },
  },
  Card: 'Card',
  Text: 'PaperText',
  Button: 'Button',
  ActivityIndicator: 'ActivityIndicator',
  Surface: 'Surface',
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#6200EE',
      primaryContainer: '#E8DEF8',
      surface: '#FFFFFF',
      surfaceVariant: '#E7E0EC',
      onSurface: '#1C1B1F',
      onSurfaceVariant: '#49454F',
    },
  })),
  IconButton: 'IconButton',
  Divider: 'Divider',
}));
// Mock asset requires
jest.mock('./assets/images/favicon.png', () => 'mocked-favicon-path', { virtual: true });

// Mock theme
jest.mock('./src/theme/theme', () => ({
  theme: {
    colors: {
      primary: '#6200EE',
      primaryContainer: '#E8DEF8',
      surface: '#FFFFFF',
      surfaceVariant: '#E7E0EC',
      onSurface: '#1C1B1F',
      onSurfaceVariant: '#49454F',
    },
    roundness: 4,
    fonts: {
      headlineMedium: { fontSize: 28, fontWeight: '400' },
      headlineSmall: { fontSize: 24, fontWeight: '400' },
      titleLarge: { fontSize: 22, fontWeight: '400' },
      titleMedium: { fontSize: 16, fontWeight: '500' },
      titleSmall: { fontSize: 14, fontWeight: '500' },
      bodyLarge: { fontSize: 16, fontWeight: '400' },
      bodyMedium: { fontSize: 14, fontWeight: '400' },
      bodySmall: { fontSize: 12, fontWeight: '400' },
    },
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
