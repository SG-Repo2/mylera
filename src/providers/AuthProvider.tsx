/**
 * Key points:
	•	We store both session and user to manage app logic that might require more than a session token.
	•	The loading state helps display UI feedback (e.g., spinners) while auth actions are in progress.
	•	The error state is updated when any registration, login, or logout operation fails.
	•	We expose register, login, and logout for the rest of the app to consume.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/src/services/supabaseClient';
import { PermissionStatus } from './health/types/permissions';
import { initializeHealthProviderForUser } from '../utils/healthInitUtils';
import { mapAuthError } from '../utils/errorUtils';
import { HealthProviderFactory } from './health/factory/HealthProviderFactory';
import { leaderboardService } from '@/src/services/leaderboardService';
interface HealthInitState {
  isInitialized: boolean;
  isInitializing: boolean;
  error: Error | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  healthPermissionStatus: PermissionStatus | null;
  healthInitState: HealthInitState;
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
  const [healthInitState, setHealthInitState] = useState<HealthInitState>({
    isInitialized: false,
    isInitializing: false,
    error: null
  });

  // Add operation tracking
  const [currentOperationId, setCurrentOperationId] = useState<number>(0);

  // Handle app lifecycle for health provider state management
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && user && healthPermissionStatus === 'granted') {
        // App returning to foreground - refresh state
        const refreshProviders = async () => {
          try {
            console.log('[AuthProvider] App became active, refreshing health provider...');
            
            // Get provider instance, which handles initialization internally
            const provider = await HealthProviderFactory.getProvider(undefined, user.id);
            
            // Update initialization state
            if (!healthInitState.isInitialized) {
              console.log('[AuthProvider] Provider initialized successfully');
              setHealthInitState(prev => ({
                ...prev,
                isInitialized: true,
                error: null
              }));
            }
            
            // Reset provider state and refresh metrics
            console.log('[AuthProvider] Resetting provider state...');
            await provider.resetState();
            
            console.log('[AuthProvider] Refreshing metrics...');
            await provider.getMetrics();
            
            console.log('[AuthProvider] Health provider refresh completed successfully');
          } catch (error) {
            console.error('[AuthProvider] Error refreshing health provider:', error);
            setHealthInitState(prev => ({
              ...prev,
              error: error instanceof Error ? error : new Error('Failed to refresh health provider')
            }));
            
            // Attempt recovery by marking as uninitialized
            if (error instanceof Error && error.message.includes('not initialized')) {
              console.log('[AuthProvider] Marking provider as uninitialized for next refresh attempt');
              setHealthInitState(prev => ({
                ...prev,
                isInitialized: false
              }));
            }
          }
        };
        refreshProviders();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user, healthPermissionStatus, healthInitState.isInitialized]);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const operationId = Date.now();
      console.log(`[AuthProvider] Starting initial session check (Operation ${operationId})`);
      
      setSession(session ?? null);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          console.log(`[AuthProvider] [${operationId}] Initializing health provider for user:`, session.user.id);
          await initializeHealthProviderForUser(session.user.id, setHealthPermissionStatus);
          console.log(`[AuthProvider] [${operationId}] Health provider initialized successfully`);
        } catch (error) {
          console.error(`[AuthProvider] [${operationId}] Failed to initialize health provider:`, error);
          setHealthPermissionStatus('denied');
        }
      }
      
      console.log(`[AuthProvider] [${operationId}] Initial session check complete`);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const operationId = Date.now();
      setCurrentOperationId(operationId);
      
      console.log(`[AuthProvider] [${operationId}] Auth state change detected:`, {
        event: _event,
        hasUser: !!session?.user
      });

      // Step 1: Update session and user state
      setSession(session);
      setUser(session?.user ?? null);
      console.log(`[AuthProvider] [${operationId}] Session state updated`);
      
      try {
        // Step 2: Handle cleanup or initialization based on session state
        if (!session?.user) {
          console.log(`[AuthProvider] [${operationId}] No user session, cleaning up...`);
          setHealthPermissionStatus(null);
          
          // Clean up existing provider with specific key
          const cleanupKey = `${session?.user?.id || 'default'}:os`;
          try {
            console.log(`[AuthProvider] [${operationId}] Cleaning up provider for key:`, cleanupKey);
            await HealthProviderFactory.cleanup(cleanupKey);
            console.log(`[AuthProvider] [${operationId}] Provider cleanup completed`);
          } catch (error) {
            console.warn(`[AuthProvider] [${operationId}] Error during provider cleanup:`, error);
          }
        } else {
          // Step 3: Initialize health provider for new session
          console.log(`[AuthProvider] [${operationId}] Initializing health provider for user:`, session.user.id);
          
          try {
            await initializeHealthProviderForUser(session.user.id, setHealthPermissionStatus);
            console.log(`[AuthProvider] [${operationId}] Health provider initialized successfully`);
            
            // Verify initialization
            const provider = await HealthProviderFactory.getProvider(undefined, session.user.id);
            const permissionState = await provider.checkPermissionsStatus();
            console.log(`[AuthProvider] [${operationId}] Permission state verified:`, permissionState.status);
            
          } catch (error) {
            console.error(`[AuthProvider] [${operationId}] Failed to initialize health provider:`, error);
            setHealthPermissionStatus('denied');
          }
        }
      } catch (error) {
        console.error(`[AuthProvider] [${operationId}] Error during auth state change handling:`, error);
      } finally {
        console.log(`[AuthProvider] [${operationId}] Auth state change handling completed`);
        setLoading(false);
      }
    });

    return () => {
      console.log('[AuthProvider] Cleaning up auth state subscription');
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
      setHealthInitState(prev => ({ ...prev, isInitializing: true }));

      // Use transaction-like pattern
      const cleanup = async () => {
        try {
          await HealthProviderFactory.cleanup();
        } catch (error) {
          console.warn('[AuthProvider] Cleanup error during rollback:', error);
        }
        setSession(null);
        setUser(null);
        setHealthPermissionStatus(null);
      };

      try {
        // Registration steps
        const { data, error: registrationError } = await supabase.auth.signUp({
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
        });
        if (registrationError) throw registrationError;

        // Initialize health provider
        if (data.user) {
          await initializeHealthProviderForUser(data.user.id, setHealthPermissionStatus);
        }
      } catch (error) {
        // Rollback on failure
        await cleanup();
        throw error;
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
      setHealthInitState(prev => ({ ...prev, isInitializing: false }));
    }
  };

  /**
   * Handle user login
   */
  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      setHealthInitState(prev => ({ ...prev, isInitializing: true, error: null }));

      console.log('[AuthProvider] Starting login process...');

      // Wait for any ongoing provider initialization
      console.log('[AuthProvider] Attempting login...');
      // Attempt login
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      console.log('[AuthProvider] Login successful, initializing health provider...');
      // After successful login, initialize health provider with proper sequencing
      const provider = await HealthProviderFactory.getProvider();
      
      console.log('[AuthProvider] Checking permissions status...');
      const permissionState = await provider.checkPermissionsStatus();
      setHealthPermissionStatus(permissionState.status);

      if (permissionState.status === 'granted') {
        console.log('[AuthProvider] Permissions granted, initializing provider...');
        await provider.initialize();
        setHealthInitState({
          isInitialized: true,
          isInitializing: false,
          error: null
        });
      } else {
        console.log('[AuthProvider] Permissions not granted:', permissionState.status);
        setHealthInitState({
          isInitialized: false,
          isInitializing: false,
          error: new Error(`Health permissions not granted: ${permissionState.status}`)
        });
      }

    } catch (err) {
      console.error('[AuthProvider] Login error:', err);
      setError(mapAuthError(err));
      setHealthInitState(prev => ({
        ...prev,
        isInitializing: false,
        error: err instanceof Error ? err : new Error('Unknown error during health initialization')
      }));
    } finally {
      setLoading(false);
      console.log('[AuthProvider] Login process completed');
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
          await provider.cleanup();
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
    healthInitState,
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
