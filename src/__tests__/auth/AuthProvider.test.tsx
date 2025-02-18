import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@/src/providers/AuthProvider';
import { supabase } from '@/src/services/supabaseClient';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';

// Mock Supabase client
jest.mock('@/src/services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));

// Mock HealthProviderFactory
jest.mock('@/src/providers/health/factory/HealthProviderFactory', () => ({
  HealthProviderFactory: {
    getProvider: jest.fn(),
    cleanup: jest.fn(),
  },
}));

describe('AuthProvider', () => {
  const mockSession = {
    access_token: 'mock-token',
    refresh_token: 'mock-refresh',
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful session check
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it('initializes with no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('handles successful registration', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock successful registration
    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: { user: mockSession.user },
      error: null,
    });

    // Mock successful auto-login
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    // Mock health provider
    (HealthProviderFactory.getProvider as jest.Mock).mockResolvedValueOnce({
      initialize: jest.fn(),
      checkPermissionsStatus: jest.fn().mockResolvedValue({ status: 'not_determined' }),
    });

    await act(async () => {
      await result.current.register('test@example.com', 'password123', {
        displayName: 'Test User',
        deviceType: 'os',
        measurementSystem: 'metric',
      });
    });

    expect(result.current.error).toBeNull();
    expect(supabase.auth.signUp).toHaveBeenCalled();
  });

  it('handles registration errors', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock registration error
    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: new Error('Registration failed'),
    });

    await act(async () => {
      await result.current.register('test@example.com', 'password123', {
        displayName: 'Test User',
        deviceType: 'os',
        measurementSystem: 'metric',
      });
    });

    expect(result.current.error).toBeTruthy();
  });

  it('handles successful login', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock successful login
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    // Mock health provider
    (HealthProviderFactory.getProvider as jest.Mock).mockResolvedValueOnce({
      initialize: jest.fn(),
      checkPermissionsStatus: jest.fn().mockResolvedValue({ status: 'granted' }),
    });

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(result.current.error).toBeNull();
    expect(result.current.session).toBeTruthy();
  });

  it('handles login errors', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock login error
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: new Error('Invalid credentials'),
    });

    await act(async () => {
      await result.current.login('test@example.com', 'wrong-password');
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.session).toBeNull();
  });

  it('handles successful logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Set initial authenticated state
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    // Mock successful logout
    (supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({
      error: null,
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('handles health permission requests', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock authenticated state
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    // Mock health provider
    const mockProvider = {
      initialize: jest.fn(),
      checkPermissionsStatus: jest.fn().mockResolvedValue({ status: 'granted' }),
    };
    (HealthProviderFactory.getProvider as jest.Mock).mockResolvedValueOnce(mockProvider);

    await act(async () => {
      const status = await result.current.requestHealthPermissions();
      expect(status).toBe('granted');
    });

    expect(result.current.healthPermissionStatus).toBe('granted');
  });

  it('handles health permission errors', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock authenticated state
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    // Mock health provider error
    (HealthProviderFactory.getProvider as jest.Mock).mockRejectedValueOnce(
      new Error('Health services not available')
    );

    await act(async () => {
      const status = await result.current.requestHealthPermissions();
      expect(status).toBe('denied');
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.healthPermissionStatus).toBe('denied');
  });
}); 