module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/src/test/setupTests.ts'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '\\.svg': '<rootDir>/__mocks__/svgMock.js',
    '^@/src/(.*)$': '<rootDir>/src/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/types/*',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    // Stricter requirements for critical paths
    'src/utils/**/*.{ts,tsx}': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    'src/hooks/**/*.{ts,tsx}': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'src/services/**/*.{ts,tsx}': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  testTimeout: 30000,  // Increase default timeout to 30 seconds
};
