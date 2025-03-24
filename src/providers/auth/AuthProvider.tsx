import React, { createContext, useEffect, useState, useRef } from 'react';
import { useNavigationReady } from '@/src/contexts/NavigationReadyContext';
import { mapAuthError } from '@/src/utils/errorUtils';
import { 
  AuthContextType, 
  RegisterProfileData,
  AuthState
} from './types';
import {
  registerUser,
  loginUser,
  logoutUser,
  autoLogin
} from './authService';
import {
  initializeHealthProvider,
  requestHealthPermissionsWithTimeout,
  needsHealthSetup as checkNeedsHealthSetup,
  cleanupHealthProvider,
  fetchInitialHealthMetrics
} from './healthIntegration';
import {
  navigateAfterAuth,
  createNavigationSafetyTimeout,
  processQueuedNavigation
} from './navigationUtils';
import {
  initializeAuthState,
  setupAuthStateListener,
  checkInitialSession
} from './authState';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize state from the authState module
  const authState = initializeAuthState();
  const [session, setSession] = useState(authState.session);
  const [user, setUser] = useState(authState.user);
  const [loading, setLoading] = useState(authState.loading);
  const [error, setError] = useState(authState.error);
  const [healthPermissionStatus, setHealthPermissionStatus] = useState(authState.healthPermissionStatus);
  const [healthDataInitialized, setHealthDataInitialized] = useState(authState.healthDataInitialized);
  const [isAuthNavigationLocked, setIsAuthNavigationLocked] = useState(authState.isAuthNavigationLocked);
  const metricsInitializedRef = useRef(false);
  
  // Get navigation state
  const { isReady: navigatorMounted, isPermissionsHandled } = useNavigationReady();

  // Track session initialization
  const sessionInitialized = useRef(false);

  useEffect(() => {
    // Check initial session
    checkInitialSession(
      setSession,
      setUser,
      setLoading,
      async (session) => {
        // Initialize health provider if user is logged in
        try {
          const provider = await initializeHealthProvider(
            session.user.id,
            undefined,
            setHealthPermissionStatus
          );
          
          if (!metricsInitializedRef.current) {
            // Try to fetch initial metrics
            try {
              await provider.getMetrics();
              metricsInitializedRef.current = true;
              setHealthDataInitialized(true);
            } catch (healthDataError) {
              console.warn('[AuthProvider] Initial health data fetch error:', healthDataError);
              setHealthDataInitialized(true);
            }
          }
        } catch (initError) {
          console.error('[AuthProvider] Health provider initialization error:', initError);
          setHealthDataInitialized(true);
        }
      }
    ).then(() => {
      sessionInitialized.current = true;
    });

    // Listen for session changes
    const subscription = setupAuthStateListener(
      setSession,
      setUser,
      setLoading,
      setHealthDataInitialized,
      setHealthPermissionStatus,
      async (session) => {
        // Handle health permissions on auth state change
        if (session?.user) {
          try {
            const provider = await initializeHealthProvider(
              session.user.id,
              undefined,
              setHealthPermissionStatus
            );
            
            // Only update health initialization state if not already done
            if (!metricsInitializedRef.current) {
              setHealthDataInitialized(true);
            }
          } catch (error) {
            console.error('[AuthProvider] Health init error on auth change:', error);
            setHealthDataInitialized(true);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Wait for navigator to be ready before processing initial navigation
  useEffect(() => {
    if (navigatorMounted && sessionInitialized.current && !loading) {
      console.log('[AuthProvider] Navigator mounted and session initialized - processing any pending navigation');
      processQueuedNavigation();
    }
  }, [navigatorMounted, loading]);

  /**
   * Handle user registration
   */
  const register = async (
    email: string, 
    password: string, 
    profile: RegisterProfileData
  ) => {
    // Track navigation timeout for cleanup
    let navigationTimeoutId: NodeJS.Timeout | null = null;
    
    // Prevent multiple parallel auth operations
    if (isAuthNavigationLocked) {
      console.log('[AuthProvider] Auth operation already in progress, ignoring new register request');
      return;
    }

    try {
      console.log('[AuthProvider] Starting registration process...');
      setError(null);
      setLoading(true);
      setIsAuthNavigationLocked(true); // Lock navigation
      setHealthDataInitialized(false); // Reset health data initialization state
      
      // Validate display name
      const trimmedDisplayName = profile.displayName?.trim();
      if (!trimmedDisplayName) {
        throw new Error('Display name is required');
      }
      
      console.log('[AuthProvider] Registering user with display name:', trimmedDisplayName);
      
      // Register the user using the auth service
      const user = await registerUser(email, password, profile);
      
      // Auto-login after registration
      await autoLogin(email, password);
      console.log('[AuthProvider] Auto-login successful, initializing health provider');
      
      // Initialize health provider based on device type
      const provider = await initializeHealthProvider(
        user.id,
        profile.deviceType,
        setHealthPermissionStatus
      );
      
      // Auto-request permissions during registration
      try {
        const permissionStatus = await requestHealthPermissionsWithTimeout(user.id);
        console.log('[AuthProvider] Health permissions requested during registration:', permissionStatus);
        setHealthPermissionStatus(permissionStatus);
        
        // Fetch initial metrics only if permissions were granted
        if (permissionStatus === 'granted') {
          try {
            console.log('[AuthProvider] Permissions granted, fetching initial metrics...');
            await fetchInitialHealthMetrics();
          } catch (metricsError) {
            console.warn('[AuthProvider] Error fetching initial metrics:', metricsError);
          }
        }

        setHealthDataInitialized(true);
      } catch (healthError) {
        console.error('[AuthProvider] Error requesting health permissions:', healthError);
        setHealthDataInitialized(true);
      }
      
      // Add delay before navigation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Final check to ensure health data is always initialized
      if (!healthDataInitialized) {
        setHealthDataInitialized(true);
      }
      
      // Create safety timeout
      navigationTimeoutId = createNavigationSafetyTimeout('/(app)/(home)');

      // Try normal navigation first
      if (navigateAfterAuth(navigatorMounted, '/(app)/(home)') && navigationTimeoutId) {
        clearTimeout(navigationTimeoutId);
        navigationTimeoutId = null;
      }
      
    } catch (err) {
      console.error('[AuthProvider] Registration error:', err);
      const mappedError = mapAuthError(err);
      setError(mappedError);
      setHealthDataInitialized(true);
      throw err;
    } finally {
      // Clear any navigation timeout
      if (navigationTimeoutId) {
        clearTimeout(navigationTimeoutId);
      }
      
      setLoading(false);
      setIsAuthNavigationLocked(false);
      console.log('[AuthProvider] Registration process complete. Setting loading to false');
    }
  };

  /**
   * Handle user login
   */
  const login = async (email: string, password: string) => {
    // Prevent multiple parallel auth operations
    if (isAuthNavigationLocked) {
      console.log('[AuthProvider] Auth operation already in progress, ignoring new login request');
      return;
    }

    try {
      setError(null);
      setLoading(true);
      setIsAuthNavigationLocked(true);
      setHealthDataInitialized(false);

      console.log('[AuthProvider] Starting login attempt...');
      
      // Wait for navigator to be mounted before proceeding
      if (!navigatorMounted) {
        console.log('[AuthProvider] Waiting for navigator to mount...');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Attempt login with increased timeout
      try {
        const data = await loginUser(email, password);
        if (!data.session) {
          throw new Error('No session returned from login');
        }

        console.log('[AuthProvider] Login successful, initializing health provider...');
        console.log('[AuthProvider] User display name:', data.session.user.user_metadata?.displayName);
        
        // Update session state immediately
        setSession(data.session);
        setUser(data.session.user);
        
        // Initialize health provider
        const provider = await initializeHealthProvider(
          data.session.user.id,
          undefined,
          setHealthPermissionStatus
        );
        
        // Mark health data as initialized
        setHealthDataInitialized(true);
        
        // Ensure navigator is ready before navigation
        await new Promise(resolve => setTimeout(resolve, 500));
        
        navigateAfterAuth(navigatorMounted, '/(app)/(home)', 30);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Network request failed')) {
          throw new Error('Unable to connect to the server. Please check your internet connection.');
        }
        throw error;
      }

    } catch (err) {
      console.error('[AuthProvider] Login error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setHealthDataInitialized(true);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setIsAuthNavigationLocked(false);
        console.log('[AuthProvider] Login process complete. Navigation unlocked.');
      }, 500);
    }
  };

  /**
   * Check if the user needs to set up health permissions
   */
  const needsHealthSetup = (): boolean => {
    return checkNeedsHealthSetup(healthPermissionStatus);
  };

  /**
   * Handle user logout
   */
  const logout = async () => {
    try {
      setError(null);
      setLoading(true);
      setHealthDataInitialized(false);

      // Clean up health provider state
      if (user) {
        await cleanupHealthProvider();
      }

      // Sign out from Supabase
      await logoutUser();

      // Clear all state
      setSession(null);
      setUser(null);
      setHealthPermissionStatus(null);
      
      // Add delay before navigation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Navigate to login
      navigateAfterAuth(navigatorMounted, '/(auth)/login');
      
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
  const requestHealthPermissions = async () => {
    if (!user) {
      throw new Error('User must be logged in to request health permissions');
    }

    // Update permission request logic to consider isPermissionsHandled
    if (!navigatorMounted || !isPermissionsHandled) {
      console.log('[AuthProvider] Waiting for navigator and permissions to be ready');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      setError(null);
      setLoading(true);
      setHealthDataInitialized(false);

      // Request permissions with timeout
      const status = await requestHealthPermissionsWithTimeout(user.id);
      
      setHealthPermissionStatus(status);
      
      // Try to fetch initial metrics after permissions are granted
      if (status === 'granted') {
        try {
          await fetchInitialHealthMetrics();
          setHealthDataInitialized(true);
        } catch (metricsError) {
          console.warn('[AuthProvider] Error loading metrics after permission grant:', metricsError);
          setHealthDataInitialized(true);
        }
      } else {
        setHealthDataInitialized(true);
      }
      
      return status;
      
    } catch (err) {
      console.error('[AuthProvider] Health permissions error:', err);
      const message = err instanceof Error ? err.message : 'Failed to request health permissions';
      
      // Standardize error messages for consistent UI handling
      const userMessage = message.includes('not available') ? 'Health Connect is not available' :
                         message.includes('42501') ? 'Unable to save health settings' : message;
      
      setError(userMessage);
      setHealthPermissionStatus('denied');
      setHealthDataInitialized(true);
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
    healthDataInitialized,
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

export default AuthContext; 