import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../../../app/(auth)/register';
import { AuthProvider } from '../AuthProvider';
import { leaderboardService } from '../../services/leaderboardService';
import * as ImagePicker from 'expo-image-picker';

// Import test setup
import './setup';

describe('RegisterScreen', () => {
  const mockRouter = {
    push: jest.fn().mockImplementation(() => Promise.resolve()),
    replace: jest.fn().mockImplementation(() => Promise.resolve()),
  };

  // Mock expo-router
  jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
    useFocusEffect: jest.fn(callback => callback()),
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockRouter.push.mockImplementation(() => Promise.resolve());
    mockRouter.replace.mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    // Verify no unexpected navigation occurred
    expect(mockRouter.push).toHaveBeenCalledTimes(0);
  });

  it('should handle successful registration with avatar', async () => {
    const { getByTestId, getByPlaceholderText, getByText } = render(
      <AuthProvider>
        <RegisterScreen />  
      </AuthProvider>
    );
 
    // Fill in credentials
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
      fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password123');
    });
    
    // Move to profile step
    await act(async () => {
      fireEvent.press(getByTestId('register-next-button'));
    });

    // Wait for profile step to be visible
    await waitFor(() => {
      expect(getByTestId('profile-step')).toBeTruthy();
    }, { timeout: 2000 });

    // Fill in profile details
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'Test User');
      fireEvent.press(getByTestId('register-os-device-option'));
      fireEvent.press(getByTestId('register-metric-button'));
    });

    // Submit registration
    await act(async () => {
      fireEvent.press(getByTestId('register-submit-button'));
    });

    // Verify navigation
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(onboarding)/health-setup');
    });
  });

  it('should show validation errors for invalid credentials', async () => {
    const { getByPlaceholderText, getByText, queryByText, getByTestId } = render(
      <AuthProvider>
        <RegisterScreen />
      </AuthProvider>
    );

    // Submit with invalid email
    fireEvent.changeText(getByPlaceholderText('Email'), 'invalid-email');
    fireEvent.changeText(getByPlaceholderText('Password'), 'pass');
    
    await act(async () => {
      fireEvent.press(getByTestId('register-next-button'));
    });

    await waitFor(() => {
      expect(queryByText('Please enter a valid email address.')).toBeTruthy();
    }, { timeout: 2000 });

    // Fix email but use short password
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'pass');
    
    await act(async () => {
      fireEvent.press(getByTestId('register-next-button'));
    });

    await waitFor(() => {
      expect(queryByText('Password must be at least 8 characters long and contain uppercase, lowercase, and numbers.')).toBeTruthy();
    }, { timeout: 2000 });

    // Fix password but mismatch confirmation
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password124');
    
    await act(async () => {
      fireEvent.press(getByTestId('register-next-button'));
    });

    await waitFor(() => {
      expect(queryByText('Passwords do not match.')).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('should handle registration failure gracefully', async () => {
    const { getByPlaceholderText, getByText, queryByText, getByTestId } = render(
      <AuthProvider>
        <RegisterScreen />
      </AuthProvider>
    );

    // Fill in valid credentials
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password123');
    
    // Move to profile step
    await act(async () => {
      fireEvent.press(getByTestId('register-next-button'));
    });

    // Wait for profile step to be visible
    await waitFor(() => {
      expect(getByTestId('profile-step')).toBeTruthy();
    }, { timeout: 2000 });

    // Fill in profile details
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'Test User');
    fireEvent.press(getByTestId('register-os-device-option'));

    // Mock registration failure
    const mockError = new Error('Registration failed');
    (leaderboardService.uploadAvatar as jest.Mock).mockRejectedValueOnce(mockError);

    // Attempt registration
    await act(async () => {
      fireEvent.press(getByTestId('register-submit-button'));
    });

    // Verify error message is shown
    await waitFor(() => {
      expect(queryByText('Registration failed')).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('should handle image picker cancellation', async () => {
    const { getByTestId, getByPlaceholderText, getByText } = render(
      <AuthProvider>
        <RegisterScreen />
      </AuthProvider>
    );

    // Fill in credentials and move to profile step
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password123');
    
    await act(async () => {
      fireEvent.press(getByTestId('register-next-button'));
    });

    // Wait for profile step to be visible
    await waitFor(() => {
      expect(getByTestId('profile-step')).toBeTruthy();
    });

    // Mock cancelled image picker result
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: true,
      assets: null,
    });

    // Attempt to pick avatar
    await act(async () => {
      fireEvent.press(getByTestId('avatar-picker'));
    });

    // Verify no avatar is set
    expect(getByTestId('avatar-placeholder')).toBeTruthy();
  });

  it('should show loading state during avatar upload', async () => {
    const { getByPlaceholderText, getByText, getByTestId, queryByTestId } = render(
      <AuthProvider>
        <RegisterScreen />
      </AuthProvider>
    );

    // Fill in credentials
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password123');
    
    // Move to profile step
    await act(async () => {
      fireEvent.press(getByTestId('register-next-button'));
    });

    // Wait for profile step to be visible
    await waitFor(() => {
      expect(getByTestId('profile-step')).toBeTruthy();
    });

    // Fill in profile details
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'Test User');
    fireEvent.press(getByTestId('register-os-device-option'));

    // Set up avatar upload mocks
    let resolveUpload: (value: string) => void;
    const uploadPromise = new Promise<string>(resolve => {
      resolveUpload = resolve;
    });
    (leaderboardService.uploadAvatar as jest.Mock).mockReturnValueOnce(uploadPromise);

    const mockImageResult = {
      canceled: false,
      assets: [{
        uri: 'file://test-image.jpg',
        width: 100,
        height: 100,
        type: 'image/jpeg',
      }],
    };
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce(mockImageResult);

    // Select avatar and verify it's set
    await act(async () => {
      fireEvent.press(getByTestId('avatar-picker'));
    });

    await waitFor(() => {
      expect(getByTestId('avatar-preview')).toBeTruthy();
    }, { timeout: 2000 });

    // Start registration
    await act(async () => {
      fireEvent.press(getByTestId('register-submit-button'));
    });

    // Verify loading state appears
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeTruthy();
    }, { timeout: 2000 });

    // Complete the upload
    await act(async () => {
      resolveUpload('https://test-url/avatar.jpg');
    });

    // Verify loading state is removed
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeFalsy();
    }, { timeout: 2000 });

    // Verify navigation occurred
    expect(mockRouter.replace).toHaveBeenCalledWith('/(onboarding)/health-setup');
  });

  it('should validate image types and sizes', async () => {
    const { getByTestId, getByPlaceholderText, getByText, queryByText } = render(
      <AuthProvider>
        <RegisterScreen />
      </AuthProvider>
    );

    // Fill in credentials
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password123');
    
    // Move to profile step
    await act(async () => {
      fireEvent.press(getByTestId('register-next-button'));
    });

    // Wait for profile step to be visible
    await waitFor(() => {
      expect(getByTestId('profile-step')).toBeTruthy();
    });

    // Test invalid image type
    const invalidTypeResult = {
      canceled: false,
      assets: [{
        uri: 'file://test-image.gif',
        width: 100,
        height: 100,
        type: 'image/gif',
      }],
    };
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce(invalidTypeResult);

    await act(async () => {
      fireEvent.press(getByTestId('avatar-picker'));
    });

    await waitFor(() => {
      expect(queryByText('Invalid image type. Please use JPEG, PNG, or WebP.')).toBeTruthy();
    }, { timeout: 2000 });

    // Test large file size
    const largeImageResult = {
      canceled: false,
      assets: [{
        uri: 'file://large-image.jpg',
        width: 5000,
        height: 5000,
        type: 'image/jpeg',
        fileSize: 10485760, // 10MB
      }],
    };
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce(largeImageResult);

    await act(async () => {
      fireEvent.press(getByTestId('avatar-picker'));
    });

    await waitFor(() => {
      expect(queryByText('Image size must be less than 5MB.')).toBeTruthy();
    }, { timeout: 2000 });

    // Verify avatar placeholder remains
    expect(getByTestId('avatar-placeholder')).toBeTruthy();
  });

  it('should handle navigation flow correctly', async () => {
    const { getByPlaceholderText, getByText, queryByText, getByTestId } = render(
      <AuthProvider>
        <RegisterScreen />
      </AuthProvider>
    );

    // Test initial validation - empty fields
    await act(async () => {
      fireEvent.press(getByTestId('register-next-button'));
    });

    await waitFor(() => {
      expect(queryByText('Please enter a valid email address.')).toBeTruthy();
    }, { timeout: 2000 });

    // Test email-only validation
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
      fireEvent.press(getByTestId('register-next-button'));
    });

    await waitFor(() => {
      expect(queryByText('Password must be at least 6 characters long.')).toBeTruthy();
    }, { timeout: 2000 });

    // Fill credentials and navigate to profile step
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Password'), 'Password123');
      fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'Password123');
      fireEvent.press(getByTestId('register-next-button'));
    });

    // Verify profile step loaded
    await waitFor(() => {
      expect(queryByText('Select Your Device')).toBeTruthy();
    }, { timeout: 2000 });

    // Test profile validation - empty fields
    await act(async () => {
      fireEvent.press(getByTestId('register-submit-button'));
    });

    await waitFor(() => {
      expect(queryByText('Please enter a display name')).toBeTruthy();
    }, { timeout: 2000 });

    // Test profile validation - missing device type
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'Test User');
      fireEvent.press(getByTestId('register-submit-button'));
    });

    await waitFor(() => {
      expect(queryByText('Please select a device type')).toBeTruthy();
    }, { timeout: 2000 });

    // Complete registration with all required fields
    await act(async () => {
      fireEvent.press(getByTestId('register-os-device-option'));
      fireEvent.press(getByTestId('register-submit-button'));
    });

    // Verify successful navigation
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(onboarding)/health-setup');
    }, { timeout: 2000 });
  });
});
