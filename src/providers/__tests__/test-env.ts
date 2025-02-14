// Mock environment variables
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock React Native's Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn(obj => obj.ios),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

// Mock react-native-paper components
jest.mock('react-native-paper', () => ({
  Button: 'Button',
  TextInput: 'TextInput',
  Text: 'Text',
  ActivityIndicator: 'ActivityIndicator',
  Surface: 'Surface',
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({
    canceled: false,
    assets: [{
      uri: 'file://test-image.jpg',
      width: 100,
      height: 100,
      type: 'image',
    }],
  })),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

// Mock theme
jest.mock('@/src/theme/theme', () => ({
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
