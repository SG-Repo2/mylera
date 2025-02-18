import React from 'react';
import { Platform, Alert } from 'react-native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../utils/TestProviders';
import HealthSetupScreen from '@/app/(onboarding)/health-setup';
import { useAuth } from '@/src/providers/AuthProvider';
import { useRouter } from 'expo-router';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn()
}));

jest.mock('@/src/providers/AuthProvider', () => ({
  useAuth: jest.fn()
}));

// Mock Platform.OS
const originalPlatform = Platform.OS;
const setPlatform = (os: 'ios' | 'android') => {
  Platform.OS = os;
};

// Mock Alert.alert
const originalAlert = Alert.alert;
let alertCallback: ((value: boolean) => void) | null = null;
Alert.alert = jest.fn((title, message, buttons) => {
  if (buttons && alertCallback) {
    // Store the callback for the "Skip" button
    const skipButton = buttons.find(button => button.text === 'Skip');
    if (skipButton && skipButton.onPress) {
      alertCallback(true);
    }
  }
});

describe('HealthSetupScreen', () => {
  const mockRouter = {
    replace: jest.fn()
  };

  const mockAuth = {
    requestHealthPermissions: jest.fn(),
    healthPermissionStatus: 'not_determined',
    error: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useAuth as jest.Mock).mockReturnValue(mockAuth);
    Platform.OS = originalPlatform;
  });

  afterAll(() => {
    Platform.OS = originalPlatform;
    Alert.alert = originalAlert;
  });

  it('renders initial setup screen correctly', () => {
    const { getByText, getByTestId } = renderWithProviders(<HealthSetupScreen />);

    expect(getByText('Health Integration Setup')).toBeTruthy();
    expect(getByText('Connect your health data to track your fitness progress and compete with friends.')).toBeTruthy();
    expect(getByText('Set up Health Integration')).toBeTruthy();
    expect(getByText('Skip for now')).toBeTruthy();
  });

  it('handles successful health permission grant', async () => {
    mockAuth.requestHealthPermissions.mockResolvedValueOnce('granted');

    const { getByText } = renderWithProviders(<HealthSetupScreen />);

    await act(async () => {
      fireEvent.press(getByText('Set up Health Integration'));
    });

    await waitFor(() => {
      expect(mockAuth.requestHealthPermissions).toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(home)');
    });
  });

  it('handles permission denial with retry options', async () => {
    mockAuth.requestHealthPermissions.mockResolvedValueOnce('denied');

    const { getByText, queryByText } = renderWithProviders(<HealthSetupScreen />);

    await act(async () => {
      fireEvent.press(getByText('Set up Health Integration'));
    });

    await waitFor(() => {
      expect(mockAuth.requestHealthPermissions).toHaveBeenCalled();
      expect(getByText('Retry Health Setup')).toBeTruthy();
    });

    // Should show platform-specific message after multiple retries
    mockAuth.requestHealthPermissions.mockResolvedValueOnce('denied');
    mockAuth.requestHealthPermissions.mockResolvedValueOnce('denied');

    await act(async () => {
      fireEvent.press(getByText('Retry Health Setup'));
      fireEvent.press(getByText('Retry Health Setup'));
    });

    await waitFor(() => {
      expect(mockAuth.requestHealthPermissions).toHaveBeenCalledTimes(3);
      expect(queryByText(/Please check.*settings/)).toBeTruthy();
    });
  });

  it('shows Health Connect message on Android', async () => {
    setPlatform('android');
    mockAuth.requestHealthPermissions.mockRejectedValueOnce(new Error('not available'));

    const { getByText, queryByText } = renderWithProviders(<HealthSetupScreen />);

    await act(async () => {
      fireEvent.press(getByText('Set up Health Integration'));
    });

    await waitFor(() => {
      expect(queryByText(/Health Connect is not available/)).toBeTruthy();
    });
  });

  it('shows Health Kit message on iOS', async () => {
    setPlatform('ios');
    mockAuth.requestHealthPermissions.mockResolvedValueOnce('denied');

    const { getByText, queryByText } = renderWithProviders(<HealthSetupScreen />);

    await act(async () => {
      fireEvent.press(getByText('Set up Health Integration'));
      fireEvent.press(getByText('Retry Health Setup'));
      fireEvent.press(getByText('Retry Health Setup'));
    });

    await waitFor(() => {
      expect(queryByText(/Please enable them in your device settings/)).toBeTruthy();
    });
  });

  it('handles skip confirmation dialog', async () => {
    const { getByText } = renderWithProviders(<HealthSetupScreen />);

    // Create a promise that resolves when Alert callback is called
    const skipPromise = new Promise<void>(resolve => {
      alertCallback = () => resolve();
    });

    // Press skip button
    await act(async () => {
      fireEvent.press(getByText('Skip for now'));
    });

    // Verify alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Skip Health Integration?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Skip' })
      ])
    );

    // Simulate pressing "Skip" in the alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const skipButton = alertCall[2].find((button: any) => button.text === 'Skip');
    await act(async () => {
      skipButton.onPress();
      await skipPromise;
    });

    // Verify navigation
    expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(home)');
  });

  it('handles error during health setup', async () => {
    mockAuth.requestHealthPermissions.mockRejectedValueOnce(new Error('42501'));

    const { getByText, queryByText } = renderWithProviders(<HealthSetupScreen />);

    await act(async () => {
      fireEvent.press(getByText('Set up Health Integration'));
    });

    await waitFor(() => {
      expect(queryByText('Unable to save health settings. Please try again later.')).toBeTruthy();
    });
  });
});
