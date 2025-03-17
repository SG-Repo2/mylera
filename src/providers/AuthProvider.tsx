import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/src/services/supabaseClient';
import { PermissionStatus } from '@/src/providers/health/types/permissions';
import { standardizeError, logError } from '../utils/errorUtils';
import { leaderboardService } from '@/src/services/leaderboardService';
import { useNavigationReady } from '@/src/contexts/NavigationReadyContext';
import { navigationQueue } from '@/src/utils/NavigationUtils';
import { authReducer, initialAuthState, authActions, AuthState } from '../reducers/authReducer';
import { useHealthPermissions } from '../hooks/useHealthPermissions';
import { useAuthNavigation } from '../hooks/useAuthNavigation';

/**
 * Interface for profile data during registration
 */
export interface RegisterProfileData {
  displayName: string;
  deviceType: 'os' | 'fitbit';
  measurementSystem: 'metric' | 'imperial';
  avatarUri?: string | null;
  showProfile?: boolean;
}

/**
 * Auth context interface for consuming components
 */
export interface AuthContextType {
  // State
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  healthPermissionStatus: PermissionStatus | null;
  healthDataInitialized: boolean; 
  
  // Auth methods
  register: (email: string, password: string, profileData?: RegisterProfileData) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // Health methods
  requestHealthPermissions: () => Promise<PermissionStatus>;
  needsHealthSetup: () => boolean;
}

// Create the context with undefined default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication Provider Component
 * Handles user authentication state and health permissions
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Use reducer for state management instead of multiple useState
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  
  // Track session initialization
  const sessionInitialized = useRef(false);
  
  // Get navigation ready state
  const { isReady: navigatorMounted } = useNavigationReady();
  
  // Use auth navigation hook for navigation logic
  const {
    navigateToHome,
    navigateToLogin,
    processQueuedNavigation
  } = useAuthNavigation();
  
  // Use health permissions hook for health-related logic
  const healthPermissions = useHealthPermissions(state.user?.id || null);

  /**
   * Handle initial session check and setup auth state change listener
   */
  useEffect(() => {
    // Check initial session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          dispatch(authActions.setSession(session));
          dispatch(authActions.setUser(session.user));
        }
        
        sessionInitialized.current = true;
        dispatch(authActions.setLoading(false));
      } catch (error) {
        logError('AuthProvider', error, { context: 'initialSessionCheck' });
        sessionInitialized.current = true;
        dispatch(authActions.setLoading(false));
      }
    };

    checkSession();

    // Listen for session changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      dispatch(authActions.setSession(session));
      dispatch(authActions.setUser(session?.user ?? null));
      
      // Reset health data initialization on session change
      dispatch(authActions.setHealthDataInitialized(false));
      
      // Update session initialized flag
      sessionInitialized.current = true;
      
      // Finish loading after session change
      dispatch(authActions.setLoading(false));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sync health permissions state with auth state
  useEffect(() => {
    dispatch(authActions.setHealthPermissionStatus(healthPermissions.permissionStatus));
    dispatch(authActions.setHealthDataInitialized(healthPermissions.isInitialized));
    
    if (healthPermissions.error) {
      dispatch(authActions.setError(standardizeError(healthPermissions.error)));
    }
  }, [
    healthPermissions.permissionStatus,
    healthPermissions.isInitialized, 
    healthPermissions.error
  ]);

  // Process navigation queue when navigator is mounted and session is initialized
  useEffect(() => {
    if (navigatorMounted && sessionInitialized.current && !state.loading) {
      console.log('[AuthProvider] Navigator mounted and session initialized - processing any pending navigation');
      processQueuedNavigation();
    }
  }, [navigatorMounted, state.loading, processQueuedNavigation]);

  // Update permissions handled flag in navigation queue
  useEffect(() => {
    if (state.healthPermissionStatus !== null) {
      navigationQueue.setPermissionsHandled(true);
    }
  }, [state.healthPermissionStatus]);

  /**
   * Handle user registration
   */
  const register = useCallback(async (
    email: string, 
    password: string, 
    profile: RegisterProfileData
  ) => {
    // Prevent multiple parallel auth operations
    if (state.isAuthNavigationLocked) {
      console.log('[AuthProvider] Auth operation already in progress, ignoring new register request');
      return;
    }

    // Setup navigation timeout for safety
    let navigationTimeoutId: NodeJS.Timeout | null = null;

    try {
      console.log('[AuthProvider] Starting registration process...');
      
      // Start auth operation
      dispatch(authActions.startAuthOperation());
      
      // Validate display name
      if (!profile.displayName?.trim()) {
        throw new Error('Display name is required');
      }

      // First sign up with minimal metadata
      console.log('[AuthProvider] Registering user with Supabase...');
      const signUpData = {
        email,
        password,
        options: {
          data: {
            displayName: profile.displayName.trim(),
          },
        },
      };
      
      // Attempt registration
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
      
      // Update user metadata with full profile
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            displayName: profile.displayName.trim(),
            deviceType: profile.deviceType,
            measurementSystem: profile.measurementSystem,
            avatarUri: profile.avatarUri,
            showProfile: profile.showProfile ?? true,
          }
        });
        
        if (updateError) {
          console.warn('[AuthProvider] Error updating user metadata:', updateError);
        }
        
        // Create initial leaderboard profile
        try {
          await leaderboardService.updateUserProfile(data.user.id, {
            display_name: profile.displayName.trim(),
            device_type: profile.deviceType,
            measurement_system: profile.measurementSystem,
            avatar_url: profile.avatarUri || null,
            show_profile: profile.showProfile ?? true,
          });
        } catch (profileError) {
          console.warn('[AuthProvider] Error creating leaderboard profile:', profileError);
        }
      } catch (metadataError) {
        console.warn('[AuthProvider] Error updating metadata:', metadataError);
      }

      // Auto-login after registration
      try {
        console.log('[AuthProvider] Attempting auto-login...');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) {
          throw signInError;
        }
      } catch (loginError) {
        console.error('[AuthProvider] Auto-login failed:', loginError);
        throw loginError;
      }
      
      // Initialize health provider and request permissions
      await healthPermissions.initializeHealthProvider(true);
      try {
        await healthPermissions.requestPermissions();
      } catch (permissionsError) {
        console.warn('[AuthProvider] Error requesting health permissions:', permissionsError);
        // Continue even if permissions fail
      }

      // Create safety timeout for navigation
      navigationTimeoutId = setTimeout(() => {
        console.log('[AuthProvider] Forcing navigation due to timeout');
        navigateToHome(10);
        navigationTimeoutId = null;
      }, 2000);

      // Try normal navigation
      navigateToHome(10);
      
      // Clear timeout if navigation was triggered
      if (navigationTimeoutId) {
        clearTimeout(navigationTimeoutId);
        navigationTimeoutId = null;
      }
      
    } catch (err) {
      logError('AuthProvider', err, { context: 'registration' });
      
      const standardErr = standardizeError(err);
      dispatch(authActions.setError(standardErr));
      
      // Mark health data as initialized to avoid blocking UI
      dispatch(authActions.setHealthDataInitialized(true));
      
      // Rethrow for caller handling
      throw err;
    } finally {
      // Clear navigation timeout
      if (navigationTimeoutId) {
        clearTimeout(navigationTimeoutId);
      }
      
      // End auth operation
      dispatch(authActions.endAuthOperation());
      console.log('[AuthProvider] Registration process complete');
    }
  }, [state.isAuthNavigationLocked, healthPermissions, navigateToHome]);

  /**
   * Handle user login
   */
  const login = useCallback(async (email: string, password: string) => {
    // Prevent multiple parallel auth operations
    if (state.isAuthNavigationLocked) {
      console.log('[AuthProvider] Auth operation already in progress, ignoring new login request');
      return;
    }

    try {
      // Start auth operation
      dispatch(authActions.startAuthOperation());

      console.log('[AuthProvider] Starting login attempt...');
      
      // Attempt to log in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) throw signInError;

      console.log('[AuthProvider] Login successful, initializing health provider...');
      
      // Initialize health provider and data
      await healthPermissions.initializeHealthProvider(true);
      
      // Add small delay before navigation
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Navigate to home when health data is initialized
      navigateToHome(10);

    } catch (err) {
      logError('AuthProvider', err, { context: 'login' });
      
      const standardErr = standardizeError(err);
      dispatch(authActions.setError(standardErr));
      
      // Mark health data as initialized to avoid blocking UI
      dispatch(authActions.setHealthDataInitialized(true));
    } finally {
      // Use a short delay before ending auth operation
      setTimeout(() => {
        dispatch(authActions.endAuthOperation());
        console.log('[AuthProvider] Login process complete');
      }, 100);
    }
  }, [state.isAuthNavigationLocked, healthPermissions, navigateToHome]);

  /**
   * Check if the user needs to set up health permissions
   */
  const needsHealthSetup = useCallback((): boolean => {
    return healthPermissions.needsHealthSetup();
  }, [healthPermissions]);

  /**
   * Handle user logout
   */
  const logout = useCallback(async () => {
    try {
      // Start auth operation
      dispatch(authActions.startAuthOperation());

      // Clean up health provider
      await healthPermissions.cleanupHealthProvider();

      // Sign out from Supabase
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      // Reset auth state
      dispatch(authActions.logout());
      
      // Add delay before navigation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Navigate to login
      navigateToLogin(10);
      
    } catch (err) {
      logError('AuthProvider', err, { context: 'logout' });
      
      const standardErr = standardizeError(err);
      dispatch(authActions.setError(standardErr));
      
      // If there was an error during logout, still reset session state
      // to ensure user can sign in again
      if (err instanceof Error && err.message.includes('42501')) {
        dispatch(authActions.logout());
      }
    } finally {
      // End auth operation
      dispatch(authActions.endAuthOperation());
      console.log('[AuthProvider] Logout process complete');
    }
  }, [healthPermissions, navigateToLogin]);

  /**
   * Request health permissions for the current user
   */
  const requestHealthPermissions = useCallback(async (): Promise<PermissionStatus> => {
    if (!state.user) {
      throw new Error('User must be logged in to request health permissions');
    }

    try {
      // Start health operation
      dispatch(authActions.startHealthOperation());
      
      // Request health permissions
      const status = await healthPermissions.requestPermissions();
      
      return status;
    } catch (err) {
      logError('AuthProvider', err, { context: 'requestHealthPermissions' });
      
      const standardErr = standardizeError(err);
      dispatch(authActions.setError(standardErr));
      
      return 'denied';
    } finally {
      // End health operation
      dispatch(authActions.endHealthOperation());
    }
  }, [state.user, healthPermissions]);

  // Create context value object
  const contextValue: AuthContextType = {
    session: state.session,
    user: state.user,
    loading: state.loading,
    error: state.error?.message || null,
    healthPermissionStatus: state.healthPermissionStatus,
    healthDataInitialized: state.healthDataInitialized,
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

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to use the auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}