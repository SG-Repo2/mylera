import React from 'react';
import { renderWithProviders, fireEvent, screen } from '../utils/TestWrapper';
import { mockRouter } from '../utils/routerMock';
import Register from '@/app/(auth)/register';
import * as ImagePicker from 'expo-image-picker';
import { leaderboardService } from '@/src/services/leaderboardService';

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

// Mock leaderboardService
jest.mock('@/src/services/leaderboardService', () => ({
  leaderboardService: {
    uploadAvatar: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockRouter.pathname,
}));

describe('Register Screen', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
    jest.clearAllMocks();
    // Mock successful permission request
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
  });

  it('renders register form', () => {
    const { getByTestId } = renderWithProviders(<Register />);
    
    expect(getByTestId('register-form')).toBeTruthy();
  });

  it('handles successful registration', async () => {
    const { getByTestId } = renderWithProviders(<Register />);

    fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.press(getByTestId('register-button'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/(onboarding)/health-setup');
  });

  it('validates email format', async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(<Register />);

    const emailInput = getByPlaceholderText('Email');
    fireEvent.changeText(emailInput, 'invalid-email');

    const nextButton = getByText('Next');
    fireEvent.press(nextButton);

    await screen.findByText('Please enter a valid email address.');
  });

  it('validates password length', async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(<Register />);

    const emailInput = getByPlaceholderText('Email');
    const passwordInput = getByPlaceholderText('Password');
    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, '12345');

    const nextButton = getByText('Next');
    fireEvent.press(nextButton);

    await screen.findByText('Password must be at least 6 characters long.');
  });

  it('validates password confirmation match', async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(<Register />);

    const emailInput = getByPlaceholderText('Email');
    const passwordInput = getByPlaceholderText('Password');
    const confirmPasswordInput = getByPlaceholderText('Confirm Password');
    
    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.changeText(confirmPasswordInput, 'password124');

    const nextButton = getByText('Next');
    fireEvent.press(nextButton);

    await screen.findByText('Passwords do not match.');
  });

  it('handles avatar selection', async () => {
    const mockImageResult = {
      canceled: false,
      assets: [{ uri: 'file://mock-image.jpg' }],
    };
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(mockImageResult);

    const { getByPlaceholderText, getByText, getByTestId } = renderWithProviders(<Register />);

    // Move to profile step
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'password123');
    fireEvent.press(getByText('Next'));

    // Select avatar
    await screen.findByTestId('avatar-picker');

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
  });

  it('completes registration with all required fields', async () => {
    const { getByPlaceholderText, getByText, getByTestId } = renderWithProviders(<Register />);

    // Step 1: Credentials
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'password123');
    fireEvent.press(getByText('Next'));

    // Step 2: Profile
    await screen.findByText('Select Your Device');
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'Test User');
    fireEvent.press(getByText('Apple Health / Google Fit'));
    fireEvent.press(getByText('Metric'));

    // Complete registration
    fireEvent.press(getByText('Create Account'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/(onboarding)/health-setup');
  });

  it('handles registration errors', async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(<Register />);

    // Fill in all required fields
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'password123');
    fireEvent.press(getByText('Next'));

    await screen.findByText('Test User');
    fireEvent.press(getByText('Apple Health / Google Fit'));

    // Mock registration error
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockError = new Error('Registration failed');
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(mockError);

    fireEvent.press(getByText('Create Account'));

    await screen.findByText('An unexpected error occurred during registration.');
  });
}); 