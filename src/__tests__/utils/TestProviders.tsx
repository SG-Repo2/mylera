import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/src/theme/theme';
import { render, RenderOptions } from '@testing-library/react-native';
import { MockAuthProvider } from '../mocks/mockAuthProvider';
import { TestWrapperProps, TestProviderConfig, TestRenderOptions } from '../types/test.types';
import { MockFactory } from './mockFactory';

/**
 * Default test configuration
 */
const defaultConfig: TestProviderConfig = {
  initialAuth: {
    user: MockFactory.createTestUser(),
    session: MockFactory.createTestSession(MockFactory.createTestUser())
  },
  mockHealthData: MockFactory.createTestHealthData('test-user-123'),
  mockPermissions: MockFactory.createTestPermissionState()
};

/**
 * Test providers wrapper component
 * Provides all necessary context providers for testing
 */
export const TestProviders: React.FC<TestWrapperProps> = ({ children, config = defaultConfig }) => {
  const authState = config?.initialAuth || defaultConfig.initialAuth;
  
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <MockAuthProvider initialState={authState}>
          {children}
        </MockAuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

/**
 * Custom render function with providers
 */
export const renderWithProviders = (
  ui: React.ReactElement,
  { config, renderOptions = {} }: TestRenderOptions = {}
): ReturnType<typeof render> => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestProviders config={config}>{children}</TestProviders>
  );

  return render(ui, {
    wrapper: Wrapper,
    ...renderOptions
  });
};

/**
 * Create a test wrapper with custom configuration
 */
export const createTestWrapper = (config: TestProviderConfig = defaultConfig) => {
  return ({ children }: { children: React.ReactNode }) => (
    <TestProviders config={config}>{children}</TestProviders>
  );
};

/**
 * Wait for component updates
 */
export const waitForComponentUpdate = async (): Promise<void> => {
  await new Promise(resolve => setImmediate(resolve));
};

/**
 * Wait for animations to complete
 */
export const waitForAnimations = async (duration: number = 0): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, duration));
};
