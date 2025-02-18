import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RouterTestWrapper } from '../utils/RouterTestWrapper';
import { mockRouter } from '../setup/router';
import LoginScreen from '@/app/(auth)/login';

describe('Auth Router Flow', () => {
  it('redirects to health setup after successful login', async () => {
    const { getByTestId } = render(
      <RouterTestWrapper>
        <LoginScreen />
      </RouterTestWrapper>
    );

    // Simulate login
    fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.press(getByTestId('login-button'));

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(onboarding)/health-setup');
    });
  });
}); 