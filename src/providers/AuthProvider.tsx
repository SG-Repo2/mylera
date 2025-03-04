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
  showProfile?: boolean;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthPermissionStatus, setHealthPermissionStatus] = useState<PermissionStatus | null>(null);

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
      showProfile?: boolean;
    }
  ) => {
    try {
      console.log('[AuthProvider] Starting registration process...');
      setError(null);
      setLoading(true);
      
      // Validate display name first
      if (!profile.displayName?.trim()) {
        throw new Error('Display name is required');
      }

      // First attempt to sign up - only include critical metadata
      console.log('[AuthProvider] Registering user with Supabase...');
      const signUpData = {
        email,
        password,
        options: {
          data: {
            displayName: profile.displayName.trim(),
            // Only include essential fields initially to reduce chance of DB errors
          },
        },
      };
      
      // Attempt to register the user
      const { data, error } = await supabase.auth.signUp(signUpData);
      
      if (error) {
        console.error('[AuthProvider] Registration error with Supabase:', error);
        throw error;
      }
      
      if (!data.user) {
        console.error('[AuthProvider] Registration completed but no user returned');
        throw new Error('Registration failed: No user data returned');
      }
      
      console.log('[AuthProvider] User registered successfully with ID:', data.user.id);
      
      // Now update the user metadata with additional fields
      try {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            deviceType: profile.deviceType,
            measurementSystem: profile.measurementSystem,
            showProfile: profile.showProfile ?? true
          }
        });
        
        if (metadataError) {
          console.warn('[AuthProvider] Failed to update user metadata:', metadataError);
        }
      } catch (metadataError) {
        console.warn('[AuthProvider] Error updating user metadata:', metadataError);
      }
      
      // Create profile separately through the API
      try {
        console.log('[AuthProvider] Creating user profile...');
        await leaderboardService.createUserProfile(data.user.id, {
          display_name: profile.displayName.trim(),
          device_type: profile.deviceType,
          measurement_system: profile.measurementSystem,
          show_profile: profile.showProfile ?? true,
        });
        
        console.log('[AuthProvider] Initial profile created successfully');
      } catch (profileError) {
        console.error('[AuthProvider] Error creating initial profile:', profileError);
      }

      // Handle avatar upload if provided
      if (data.user && profile.avatarUri) {
        try {
          setLoading(true); // Keep loading state active
          console.log('[AuthProvider] Uploading avatar...');
          
          // Wait for avatar upload
          const avatarUrl = await leaderboardService.uploadAvatar(data.user.id, profile.avatarUri);
          
          if (avatarUrl) {
            // Wait for profile update
            await leaderboardService.updateUserProfile(data.user.id, {
              avatar_url: avatarUrl
            });
            console.log('[AuthProvider] Avatar uploaded and profile updated');
          }
        } catch (uploadError) {
          console.error('[AuthProvider] Avatar upload failed:', uploadError);
          // Continue even if avatar upload fails
        } finally {
          setLoading(false); // Ensure loading state is reset
        }
      }

      // Initialize health provider for new user
      try {
        console.log('[AuthProvider] Attempting auto-login...');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) {
          throw signInError;
        }
        
        console.log('[AuthProvider] Auto-login successful, initializing health provider');
        
        // Initialize health provider based on device type
        const provider = HealthProviderFactory.getProvider(profile.deviceType);
        
        if (profile.deviceType === 'fitbit') {
          const status = await provider.requestPermissions();
          if (status !== 'granted') {
            console.warn('[AuthProvider] Fitbit permissions not granted');
          }
        }
        
        await initializeHealthProviderForUser(data.user.id, setHealthPermissionStatus);
        console.log('[AuthProvider] Health provider initialized successfully');
      } catch (healthError) {
        console.error('[AuthProvider] Error initializing health provider:', healthError);
        // Don't block registration on health provider errors
      }
      
      console.log('[AuthProvider] Registration process completed successfully');
    } catch (err) {
      console.error('[AuthProvider] Registration error:', err);
      const mappedError = mapAuthError(err);
      setError(mappedError);
      throw err; // Re-throw to allow caller to handle
    } finally {
      setLoading(false);
      console.log('[AuthProvider] Registration process complete. Setting loading to false');
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
      const provider = HealthProviderFactory.getProvider();
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
          const provider = HealthProviderFactory.getProvider();
          await provider.cleanup?.();
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

      const provider = HealthProviderFactory.getProvider();
      
      // Ensure provider is properly initialized with permissions
      try {
        await provider.initializeWithPermissions(user.id);
      } catch (initError) {
        console.error('[AuthProvider] Error initializing health provider:', initError);
        throw initError;
      }
      
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
