import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../utils/TestProviders';
import { MockFactory } from '../../utils/mockFactory';
import Register from '@/app/(auth)/register';
import { supabase } from '@/src/services/supabaseClient';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';
import { leaderboardService } from '@/src/services/leaderboardService';

// Mock dependencies
jest.mock('@/src/services/supabaseClient');
jest.mock('@/src/providers/health/factory/HealthProviderFactory');
jest.mock('@/src/services/leaderboardService');

describe('User Registration Flow', () => {
  const validEmail = 'test@example.com';
  const validPassword = 'Password123!';
  const validDisplayName = 'Test User';
  const mockUser = MockFactory.createTestUser();
  const mockSession = MockFactory.createTestSession(mockUser);
  const mockHealthProvider = MockFactory.createTestHealthProvider();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase auth methods
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
      error: null
    });

    // Mock health provider factory
    (HealthProviderFactory.getProvider as jest.Mock).mockResolvedValue(mockHealthProvider);

    // Mock leaderboard service
    (leaderboardService.uploadAvatar as jest.Mock).mockResolvedValue('https://example.com/avatar.jpg');
    (leaderboardService.updateUserProfile as jest.Mock).mockResolvedValue({ data: null, error: null });
  });

  it('completes full registration process successfully', async () => {
    const { getByTestId, getByText, queryByText } = renderWithProviders(<Register />);

    // Fill in registration form
    await act(async () => {
      fireEvent.changeText(getByTestId('email-input'), validEmail);
      fireEvent.changeText(getByTestId('password-input'), validPassword);
      fireEvent.changeText(getByTestId('display-name-input'), validDisplayName);
      fireEvent.press(getByTestId('device-type-selector'));
      fireEvent.press(getByText('iOS'));
      fireEvent.press(getByTestId('measurement-system-selector'));
      fireEvent.press(getByText('Metric'));
    });

    // Submit registration
    await act(async () => {
      fireEvent.press(getByTestId('register-button'));
    });

    // Verify registration success
    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: validEmail,
        password: validPassword,
        options: {
          data: {
            displayName: validDisplayName,
            deviceType: 'ios',
            measurementSystem: 'metric'
          }
        }
      });
    });

    // Verify auto-login
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: validEmail,
        password: validPassword
      });
    });

    // Verify health provider setup
    await waitFor(() => {
      expect(HealthProviderFactory.getProvider).toHaveBeenCalledWith('ios');
      expect(mockHealthProvider.initialize).toHaveBeenCalled();
      expect(mockHealthProvider.checkPermissionsStatus).toHaveBeenCalled();
    });

    // Verify successful completion
    await waitFor(() => {
      expect(queryByText('Registration successful!')).toBeTruthy();
    });
  });

  it('handles registration validation errors', async () => {
    const { getByTestId, getByText } = renderWithProviders(<Register />);

    // Submit with invalid email
    await act(async () => {
      fireEvent.changeText(getByTestId('email-input'), 'invalid-email');
      fireEvent.changeText(getByTestId('password-input'), validPassword);
      fireEvent.press(getByTestId('register-button'));
    });

    await waitFor(() => {
      expect(getByText('Please enter a valid email address')).toBeTruthy();
    });

    // Submit with weak password
    await act(async () => {
      fireEvent.changeText(getByTestId('email-input'), validEmail);
      fireEvent.changeText(getByTestId('password-input'), 'weak');
      fireEvent.press(getByTestId('register-button'));
    });

    await waitFor(() => {
      expect(getByText('Password must be at least 8 characters')).toBeTruthy();
    });
  });

  it('handles registration service errors', async () => {
    const { getByTestId, getByText } = renderWithProviders(<Register />);

    // Mock registration error
    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: new Error('Email already registered')
    });

    // Fill form and submit
    await act(async () => {
      fireEvent.changeText(getByTestId('email-input'), validEmail);
      fireEvent.changeText(getByTestId('password-input'), validPassword);
      fireEvent.changeText(getByTestId('display-name-input'), validDisplayName);
      fireEvent.press(getByTestId('register-button'));
    });

    await waitFor(() => {
      expect(getByText('Email already registered')).toBeTruthy();
    });
  });

  it('handles health provider setup errors', async () => {
    const { getByTestId, getByText } = renderWithProviders(<Register />);

    // Mock health provider error
    const initializeMock = mockHealthProvider.initialize as jest.Mock;
    initializeMock.mockRejectedValueOnce(
      new Error('Health provider not available')
    );

    // Complete registration
    await act(async () => {
      fireEvent.changeText(getByTestId('email-input'), validEmail);
      fireEvent.changeText(getByTestId('password-input'), validPassword);
      fireEvent.changeText(getByTestId('display-name-input'), validDisplayName);
      fireEvent.press(getByTestId('register-button'));
    });

    await waitFor(() => {
      expect(getByText('Failed to initialize health provider')).toBeTruthy();
      expect(getByTestId('retry-button')).toBeTruthy();
    });

    // Test retry functionality
    initializeMock.mockResolvedValueOnce(undefined);
    
    await act(async () => {
      fireEvent.press(getByTestId('retry-button'));
    });

    await waitFor(() => {
      expect(mockHealthProvider.initialize).toHaveBeenCalledTimes(2);
    });
  });

  it('handles avatar upload during registration', async () => {
    const { getByTestId, getByText } = renderWithProviders(<Register />);
    const mockAvatarUri = 'file:///path/to/avatar.jpg';

    // Fill in registration form with avatar
    await act(async () => {
      fireEvent.changeText(getByTestId('email-input'), validEmail);
      fireEvent.changeText(getByTestId('password-input'), validPassword);
      fireEvent.changeText(getByTestId('display-name-input'), validDisplayName);
      // Simulate avatar selection
      fireEvent.press(getByTestId('avatar-picker'));
      // Mock the image picker result
      fireEvent(getByTestId('avatar-picker'), 'onImageSelected', mockAvatarUri);
    });

    // Submit registration
    await act(async () => {
      fireEvent.press(getByTestId('register-button'));
    });

    // Verify avatar upload
    await waitFor(() => {
      expect(leaderboardService.uploadAvatar).toHaveBeenCalledWith(
        mockUser.id,
        mockAvatarUri
      );
      expect(leaderboardService.updateUserProfile).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          avatar_url: 'https://example.com/avatar.jpg'
        })
      );
    });
  });
});
