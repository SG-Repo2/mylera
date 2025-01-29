
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
import { HealthProviderFactory } from './health/factory/HealthProviderFactory';
import { PermissionStatus } from './health/types/permissions';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  healthPermissionStatus: PermissionStatus | null;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  requestHealthPermissions: () => Promise<PermissionStatus>;
  needsHealthSetup: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
        try {
          const provider = HealthProviderFactory.getProvider();
          await provider.initializePermissions(session.user.id);
          const permissionState = await provider.checkPermissionsStatus();
          setHealthPermissionStatus(permissionState.status);
        } catch (error) {
          console.error('Error initializing health provider:', error);
          setHealthPermissionStatus('not_determined');
        }
      }
      
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
        try {
          const provider = HealthProviderFactory.getProvider();
          await provider.initializePermissions(session.user.id);
          const permissionState = await provider.checkPermissionsStatus();
          setHealthPermissionStatus(permissionState.status);
        } catch (error) {
          console.error('Error checking health permissions:', error);
          setHealthPermissionStatus('not_determined');
        }
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
  const register = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);

      // Attempt registration
      const { error: signUpError, data } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;

      // Initialize health provider for new user
      if (data.user) {
        try {
          const provider = HealthProviderFactory.getProvider();
          await provider.initializePermissions(data.user.id);
          setHealthPermissionStatus('not_determined');
        } catch (healthError) {
          console.error('Health provider initialization error:', healthError);
          // Don't throw here - we want the registration to succeed even if health init fails
          setHealthPermissionStatus('not_determined');
        }
      }
    } catch (err) {
      console.error('Registration error:', err);
      if (err instanceof Error) {
        if (err.message.includes('42501')) {
          setError('Unable to create user profile. Please contact support.');
        } else if (err.message.includes('HealthKit')) {
          setError('Unable to initialize health services. You can set this up later.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An error occurred during registration.');
      }
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
      if (err instanceof Error) {
        if (err.message.includes('42501')) {
          setError('You do not have permission to access this resource. Please contact support.');
        } else if (err.message.includes('HealthKit')) {
          setError('Unable to access health data. Please check your device settings.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An error occurred during login.');
      }
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
      if (err instanceof Error) {
        if (err.message.includes('42501')) {
          // Still clear local state even if there's a permission error
          setSession(null);
          setUser(null);
          setHealthPermissionStatus(null);
        }
        setError(err.message);
      } else {
        setError('An error occurred during logout.');
      }
    } finally {
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
      const message = err instanceof Error ? err.message : 'Failed to request health permissions';
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
    register,
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