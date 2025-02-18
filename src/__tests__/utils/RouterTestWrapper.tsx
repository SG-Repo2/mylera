import React from 'react';
import { AuthProvider } from '@/src/providers/AuthProvider';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/src/theme/theme';

interface RouterTestWrapperProps {
  children: React.ReactNode;
}

export function RouterTestWrapper({ children }: RouterTestWrapperProps) {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>{children}</AuthProvider>
    </PaperProvider>
  );
} 