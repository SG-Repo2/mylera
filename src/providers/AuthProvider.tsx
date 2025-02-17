/**
 * Key points:
	•	We store both session and user to manage app logic that might require more than a session token.
	•	The loading state helps display UI feedback (e.g., spinners) while auth actions are in progress.
	•	The error state is updated when any registration, login, or logout operation fails.
	•	We expose register, login, and logout for the rest of the app to consume.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/src/services/supabaseClient';
import { PermissionStatus } from './health/types/permissions';
import { initializeHealthProviderForUser } from '../utils/healthInitUtils';
import { mapAuthError } from '../utils/errorUtils';
import { HealthProviderFactory } from './health/factory/HealthProviderFactory';
import { leaderboardService } from '@/src/services/leaderboardService';
interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  healthPermissionStatus: PermissionStatus | null;
  register: (email: string, password: string, profileData?: RegisterProfileData) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  requestHealthPermissions: () => Promise<PermissionStatus>;
  needsHealthSetup: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface RegisterProfileData {
  displayName: string;
  deviceType: 'os' | 'fitbit';
  measurementSystem: 'metric' | 'imperial';
  avatarUri?: string | null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthPermissionStatus, setHealthPermissionStatus] = useState<PermissionStatus | null>(
    null
  );

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session ?? null);
      setUser(session?.user ?? null);

      // Initialize health provider if user is logged in
      if (session?.user) {
        await initializeHealthProviderForUser(session.user.id, setHealthPermissionStatus);
      }

      console.log('[AuthProvider] Initial session check complete. Setting loading to false');
      setLoading(false);
    });

    // Listen for session changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Handle health permissions on auth state change
      if (session?.user) {
        await initializeHealthProviderForUser(session.user.id, setHealthPermissionStatus);
      } else {
        setHealthPermissionStatus(null);
      }

      console.log('[AuthProvider] Auth state changed:', { session, user: session?.user });
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Handle user registration
   */
  const register = async (
    email: string,
    password: string,
    profile: {
      displayName: string;
      deviceType: 'os' | 'fitbit';
      measurementSystem: 'metric' | 'imperial';
      avatarUri?: string | null;
    }
  ) => {
    try {
      console.log('[AuthProvider] Starting registration process...');
      setError(null);
      setLoading(true);

      console.log('[AuthProvider] Calling supabase.auth.signUp...');
      const signUpData = {
        email,
        password,
        options: {
          data: {
            displayName: profile.displayName,
            deviceType: profile.deviceType,
            measurementSystem: profile.measurementSystem,
            avatarUri: profile.avatarUri,
          },
        },
      };
      console.log('[AuthProvider] signUpData:', signUpData);
      const { data, error } = await supabase.auth.signUp(signUpData);
      console.log('[AuthProvider] supabase.auth.signUp complete');

      if (error) {
        console.error('[AuthProvider] supabase.auth.signUp error:', error);
        throw error;
      }

      // Handle avatar upload if provided
      if (data.user && profile.avatarUri) {
        try {
          console.log('[AuthProvider] Calling leaderboardService.uploadAvatar...');
          const avatarUrl = await leaderboardService.uploadAvatar(data.user.id, profile.avatarUri);
          console.log('[AuthProvider] leaderboardService.uploadAvatar complete');
          // Update user profile with avatar URL
          console.log('[AuthProvider] Calling leaderboardService.updateUserProfile...');
          await leaderboardService.updateUserProfile(data.user.id, {
            ...profile,
            avatar_url: avatarUrl,
          });
          console.log('[AuthProvider] leaderboardService.updateUserProfile complete');
          console.log('[AuthProvider] User profile updated successfully');
        } catch (uploadError) {
          console.error('Avatar upload failed:', uploadError);
          // Don't throw here - the user is still registered, just without an avatar
        }
      }

      // Initialize health provider for new user
      if (data.user) {
        console.log('[AuthProvider] User created, attempting auto-login...');
        console.log('[AuthProvider] Calling supabase.auth.signInWithPassword...');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        console.log('[AuthProvider] supabase.auth.signInWithPassword complete');

        if (signInError) {
          console.error('[AuthProvider] Auto-login failed:', signInError);
          throw signInError;
        }

        console.log('[AuthProvider] Auto-login successful, initializing health provider');

        // Initialize the appropriate health provider based on device type
        const provider = await HealthProviderFactory.getProvider(profile.deviceType);

        // If it's a Fitbit device, handle OAuth flow
        if (profile.deviceType === 'fitbit') {
          console.log('[AuthProvider] Initiating Fitbit OAuth flow...');
          const permissionState = await provider.checkPermissionsStatus();
          if (permissionState.status !== 'granted') {
            throw new Error('Fitbit permissions not granted');
          }
        }

        await initializeHealthProviderForUser(data.user.id, setHealthPermissionStatus);
      }
    } catch (err) {
      console.error('[AuthProvider] Registration error:', err);
      const mappedError = mapAuthError(err);
      console.log('[AuthProvider] Mapped error:', mappedError);
      setError(mappedError);
    } finally {
      console.log('[AuthProvider] Registration process complete. Setting loading to false');
      setLoading(false);
      console.log('[AuthProvider] setLoading(false) in register');
    }
  };

  /**
   * Handle user login
   */
  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);

      // Attempt login
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      // After successful login, check health permissions
      const provider = await HealthProviderFactory.getProvider();
      const permissionState = await provider.checkPermissionsStatus();
      setHealthPermissionStatus(permissionState.status);
    } catch (err) {
      console.error('Login error:', err);
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
      console.log('[AuthProvider] setLoading(false) in login');
    }
  };

  /**
   * Check if the user needs to set up health permissions
   */
  const needsHealthSetup = (): boolean => {
    return !healthPermissionStatus || healthPermissionStatus === 'not_determined';
  };

  /**
   * Handle user logout
   */
  const logout = async () => {
    try {
      setError(null);
      setLoading(true);

      // Clean up health provider state
      if (user) {
        try {
          const provider = await HealthProviderFactory.getProvider();
          if (provider.cleanup) {
            await provider.cleanup();
          }
        } catch (healthError) {
          console.error('Error cleaning up health provider:', healthError);
          // Don't block logout on health cleanup error
        }
      }

      // Sign out from Supabase
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      // Clear all state
      setSession(null);
      setUser(null);
      setHealthPermissionStatus(null);
    } catch (err) {
      console.error('Logout error:', err);
      if (err instanceof Error && err.message.includes('42501')) {
        // Still clear local state even if there's a permission error
        setSession(null);
        setUser(null);
        setHealthPermissionStatus(null);
      }
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
      console.log('[AuthProvider] setLoading(false) in logout');
    }
  };

  /**
   * Request health permissions for the current user
   */
  const requestHealthPermissions = async (): Promise<PermissionStatus> => {
    if (!user) {
      throw new Error('User must be logged in to request health permissions');
    }

    try {
      setError(null);
      setLoading(true);

      const provider = await HealthProviderFactory.getProvider();
      const permissionState = await provider.checkPermissionsStatus();
      setHealthPermissionStatus(permissionState.status);
      return permissionState.status;
    } catch (err) {
      console.error('[AuthProvider] Health permissions error:', err);
      let message = 'Failed to request health permissions';

      if (err instanceof Error) {
        // Standardize error messages for consistent UI handling
        if (err.message.includes('not available')) {
          message = 'Health Connect is not available';
        } else if (err.message.includes('42501')) {
          message = 'Unable to save health settings';
        } else {
          message = err.message;
        }
      }

      setError(message);
      setHealthPermissionStatus('denied');
      return 'denied';
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    session,
    user,
    loading,
    error,
    healthPermissionStatus,
    register: (email: string, password: string, profileData?: RegisterProfileData) => {
      if (!profileData) {
        throw new Error('Profile data is required for registration');
      }
      return register(email, password, profileData);
    },
    login,
    logout,
    requestHealthPermissions,
    needsHealthSetup,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
