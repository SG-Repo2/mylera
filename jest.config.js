const { defaults: tsjPreset } = require('ts-jest/presets');

module.exports = {
  ...tsjPreset,
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|expo-auth-session|expo-web-browser|expo-modules-core)/)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverage: true,
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'src/**/*.{js,jsx,ts,tsx}',
    '!**/coverage/**',
    '!**/node_modules/**',
    '!**/babel.config.js',
    '!**/jest.setup.js',
  ],
  moduleDirectories: ['node_modules', '<rootDir>'],
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.jest.json'
    }
  },
  verbose: true,
  testTimeout: 60000,
};
