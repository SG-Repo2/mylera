// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock expo-auth-session
jest.mock('expo-auth-session', () => ({
  exchangeCodeAsync: jest.fn(),
  makeRedirectUri: jest.fn(),
  useAuthRequest: jest.fn(),
  ResponseType: {
    Code: 'code'
  },
  Prompt: {
    Consent: 'consent'
  }
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  warmUpAsync: jest.fn(),
  coolDownAsync: jest.fn()
}));

// Mock expo-modules-core
jest.mock('expo-modules-core', () => ({
  NativeModulesProxy: {
    ExpoWebBrowser: {
      warmUpAsync: jest.fn(),
      coolDownAsync: jest.fn(),
      openAuthSessionAsync: jest.fn()
    }
  }
}));

// Mock native modules
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn(dict => dict.ios)
}));
