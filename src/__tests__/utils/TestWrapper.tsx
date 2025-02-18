import React from 'react';
import { render } from '@testing-library/react-native';
import { AuthProvider } from '@/src/providers/AuthProvider';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/src/theme/theme';

interface TestWrapperProps {
  children: React.ReactNode;
}

export function TestWrapper({ children }: TestWrapperProps) {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </PaperProvider>
  );
}

export function renderWithProviders(ui: React.ReactElement) {
  return render(ui, {
    wrapper: TestWrapper,
  });
}

// Re-export everything
export * from '@testing-library/react-native'; 