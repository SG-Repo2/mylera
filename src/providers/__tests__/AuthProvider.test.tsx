  import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthProvider';
import { supabase } from '../../services/supabaseClient';
import { leaderboardService } from '../../services/leaderboardService';

// Mock supabase client
jest.mock('../../services/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn().mockResolvedValue({ error: null }),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'test-url' } })),
        remove: jest.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

// Mock leaderboardService
jest.mock('../../services/leaderboardService', () => ({
  leaderboardService: {
    uploadAvatar: jest.fn().mockResolvedValue('test-avatar-url'),
  },
}));

// Mock HealthProviderFactory
jest.mock('../health/factory/HealthProviderFactory', () => ({
  HealthProviderFactory: {
    getProvider: jest.fn(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      checkPermissionsStatus: jest.fn().mockResolvedValue({ status: 'not_determined' }),
      requestPermissions: jest.fn().mockResolvedValue('granted'),
    })),
  },
}));

// Test component to access auth context
const TestComponent = ({ onMount }: { onMount: (auth: ReturnType<typeof useAuth>) => void }) => {
  const auth = useAuth();
  React.useEffect(() => {
    onMount(auth);
  }, [auth, onMount]);
  return null;
};

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle successful registration with avatar', async () => {
    const mockUser = { id: 'test-user-id', email: 'test@example.com' };
    const mockProfile = {
      displayName: 'Test User',
      deviceType: 'os' as const,
      measurementSystem: 'metric' as const,
      avatarUri: 'test-avatar-uri',
    };

    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });

    let authContext: ReturnType<typeof useAuth>;
    render(
      <AuthProvider>
        <TestComponent onMount={(auth) => { authContext = auth; }} />
      </AuthProvider>
    );

    await act(async () => {
      await authContext!.register('test@example.com', 'password123', mockProfile);
    });

    // Verify user creation
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: {
        data: {
          displayName: mockProfile.displayName,
          deviceType: mockProfile.deviceType,
          measurementSystem: mockProfile.measurementSystem
        },
      },
    });

    // Verify avatar upload
    expect(leaderboardService.uploadAvatar).toHaveBeenCalledWith(
      mockUser.id,
      mockProfile.avatarUri
    );

    // Verify profile creation
    expect(supabase.from).toHaveBeenCalledWith('user_profiles');
    expect(supabase.from('user_profiles').insert).toHaveBeenCalledWith({
      id: mockUser.id,
      display_name: mockProfile.displayName,
      device_type: mockProfile.deviceType,
      measurement_system: mockProfile.measurementSystem,
      avatar_url: 'test-avatar-url',
      show_profile: false,
    });
  });

  it('should handle registration failure', async () => {
    const mockError = new Error('Registration failed');
    (supabase.auth.signUp as jest.Mock).mockRejectedValueOnce(mockError);

    let authContext: ReturnType<typeof useAuth>;
    render(
      <AuthProvider>
        <TestComponent onMount={(auth) => { authContext = auth; }} />
      </AuthProvider>
    );

    await expect(
      act(async () => {
        await authContext!.register('test@example.com', 'password123', {
          displayName: 'Test User',
          deviceType: 'os',
          measurementSystem: 'metric',
        });
      })
    ).rejects.toThrow('Registration failed');
  });

  it('should handle registration with profile creation failure', async () => {
    const mockUser = { id: 'test-user-id', email: 'test@example.com' };
    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });

    (supabase.from('user_profiles').insert as jest.Mock).mockResolvedValueOnce({
      error: new Error('Profile creation failed'),
    });

    let authContext: ReturnType<typeof useAuth>;
    render(
      <AuthProvider>
        <TestComponent onMount={(auth) => { authContext = auth; }} />
      </AuthProvider>
    );

    await expect(
      act(async () => {
        await authContext!.register('test@example.com', 'password123', {
          displayName: 'Test User',
          deviceType: 'os',
          measurementSystem: 'metric',
        });
      })
    ).rejects.toThrow('Profile creation failed');
  });

  it('should handle avatar cleanup on registration failure', async () => {
    const mockProfile = {
      displayName: 'Test User',
      deviceType: 'os' as const,
      measurementSystem: 'metric' as const,
      avatarUri: 'test-avatar-uri',
    };

    // Mock registration failure after avatar upload
    (supabase.auth.signUp as jest.Mock).mockRejectedValueOnce(new Error('Registration failed'));

    let authContext: ReturnType<typeof useAuth>;
    render(
      <AuthProvider>
        <TestComponent onMount={(auth) => { authContext = auth; }} />
      </AuthProvider>
    );

    await expect(
      act(async () => {
        await authContext!.register('test@example.com', 'password123', mockProfile);
      })
    ).rejects.toThrow('Registration failed');

    // Verify avatar cleanup was attempted
    expect(supabase.storage.from('avatars').remove).toHaveBeenCalled();
  });

  it('should continue registration if avatar upload fails', async () => {
    const mockUser = { id: 'test-user-id', email: 'test@example.com' };
    const mockProfile = {
      displayName: 'Test User',
      deviceType: 'os' as const,
      measurementSystem: 'metric' as const,
      avatarUri: 'test-avatar-uri',
    };

    // Mock successful user creation
    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });

    // Mock avatar upload to fail
    (leaderboardService.uploadAvatar as jest.Mock).mockRejectedValueOnce(
      new Error('Upload failed')
    );

    let authContext: ReturnType<typeof useAuth>;
    render(
      <AuthProvider>
        <TestComponent onMount={(auth) => { authContext = auth; }} />
      </AuthProvider>
    );

    // Should complete successfully despite avatar upload failure
    await act(async () => {
      await authContext!.register('test@example.com', 'password123', mockProfile);
    });

    // Verify profile was created without avatar URL
    expect(supabase.from('user_profiles').insert).toHaveBeenCalledWith({
      id: mockUser.id,
      display_name: mockProfile.displayName,
      device_type: mockProfile.deviceType,
      measurement_system: mockProfile.measurementSystem,
      avatar_url: null,
      show_profile: false,
    });
  });

  it('should handle existing email error', async () => {
    const mockProfile = {
      displayName: 'Test User',
      deviceType: 'os' as const,
      measurementSystem: 'metric' as const,
    };

    // Mock existing email error
    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'User already registered' },
    });

    let authContext: ReturnType<typeof useAuth>;
    render(
      <AuthProvider>
        <TestComponent onMount={(auth) => { authContext = auth; }} />
      </AuthProvider>
    );

    await expect(
      act(async () => {
        await authContext!.register('existing@example.com', 'password123', mockProfile);
      })
    ).rejects.toThrow('User already registered');
  });
});
