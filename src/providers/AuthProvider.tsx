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
  const [healthPermissionStatus, setHealthPermissionStatus] = useState<PermissionStatus | null>(null);

  useEffect(() => {
    // Check initial session
    console.log('[AuthProvider] useEffect - Checking initial session');
    setLoading(true);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[AuthProvider] useEffect - Initial session:', session);
      setSession(session ?? null);
      setUser(session?.user ?? null);
      
      // Initialize health provider if user is logged in
      if (session?.user) {
        console.log('[AuthProvider] useEffect - Initializing health provider');
        await initializeHealthProviderForUser(session.user.id, setHealthPermissionStatus);
      }
      
      console.log('[AuthProvider] useEffect - Setting loading to false');
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
      setError(null);
      setLoading(true);

      // First create the user account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            displayName: profile.displayName,
            deviceType: profile.deviceType,
            measurementSystem: profile.measurementSystem,
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error('User creation failed');

      // Handle avatar upload first if provided
      let avatarUrl = null;
      if (profile.avatarUri) {
        try {
          avatarUrl = await leaderboardService.uploadAvatar(data.user.id, profile.avatarUri);
        } catch (avatarErr) {
          console.error('Avatar upload failed:', avatarErr);
          // Continue registration but with null avatar
        }
      }

      // Create initial profile
      await leaderboardService.updateUserProfile(data.user.id, {
        display_name: profile.displayName,
        device_type: profile.deviceType,
        measurement_system: profile.measurementSystem,
        show_profile: false,
        avatar_url: avatarUrl
      });

      // Initialize health provider for new user
      if (data.user) {
        console.log('[AuthProvider] User created, attempting auto-login...');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) {
          console.error('[AuthProvider] Auto-login failed:', signInError);
          throw signInError;
        }
        
        console.log('[AuthProvider] Auto-login successful, initializing health provider');
        
        // Initialize the appropriate health provider based on device type
        const provider = HealthProviderFactory.getProvider(profile.deviceType);
        
        // If it's a Fitbit device, handle OAuth flow
        if (profile.deviceType === 'fitbit') {
          console.log('[AuthProvider] Initiating Fitbit OAuth flow...');
          const status = await provider.requestPermissions();
          if (status !== 'granted') {
            throw new Error('Fitbit permissions not granted');
          }
        }
        
        await initializeHealthProviderForUser(data.user.id, setHealthPermissionStatus);
      }
    } catch (err) {
      console.error('Registration error:', err);
      const mappedError = mapAuthError(err);
      setError(mappedError);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle user login
   */
  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);

      console.log('[AuthProvider] login - Attempting login');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        console.error('[AuthProvider] login - Login error:', signInError);
        throw signInError;
      }
      console.log('[AuthProvider] login - Login successful');

      // After successful login, check health permissions
      const provider = HealthProviderFactory.getProvider();
      const permissionState = await provider.checkPermissionsStatus();
      setHealthPermissionStatus(permissionState.status);

    } catch (err) {
      console.error('Login error:', err);
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
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

      console.log('[AuthProvider] logout - Starting logout process');

      // Clean up health provider state
      if (user) {
        try {
          console.log('[AuthProvider] logout - Cleaning up health provider');
          const provider = HealthProviderFactory.getProvider();
          await provider.cleanup?.();
        } catch (healthError) {
          console.error('[AuthProvider] logout - Error cleaning up health provider:', healthError);
          // Don't block logout on health cleanup error
        }
      }

      // Sign out from Supabase
      console.log('[AuthProvider] logout - Signing out from Supabase');
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error('[AuthProvider] logout - Sign out error:', signOutError);
        throw signOutError;
      }

      // Clear all state
      console.log('[AuthProvider] logout - Clearing session, user, and health permission status');
      setSession(null);
      setUser(null);
      setHealthPermissionStatus(null);
      
    } catch (err) {
      console.error('[AuthProvider] logout - Logout error:', err);
      if (err instanceof Error && err.message.includes('42501')) {
        // Still clear local state even if there's a permission error
        console.log('[AuthProvider] logout - Permission error, still clearing local state');
        setSession(null);
        setUser(null);
        setHealthPermissionStatus(null);
      }
      setError(mapAuthError(err));
    } finally {
      console.log('[AuthProvider] logout - Setting loading to false');
      setLoading(false);
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

      const provider = HealthProviderFactory.getProvider();
      const status = await provider.requestPermissions();
      setHealthPermissionStatus(status);
      return status;
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
