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

// Add auth transition state to track auth state stability
interface AuthTransitionState {
  isTransitioning: boolean;
  operation: 'none' | 'login' | 'logout' | 'session-check';
  startTime: number | null;
}

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
  authTransition: AuthTransitionState;
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
  const [currentOperationId, setCurrentOperationId] = useState<number>(0);
  const [healthInitState, setHealthInitState] = useState<HealthInitState>({
    isInitialized: false,
    isInitializing: false,
    error: null
  });
  
  // Add auth transition tracking
  const [authTransition, setAuthTransition] = useState<AuthTransitionState>({
    isTransitioning: false,
    operation: 'none',
    startTime: null
  });

  // Helper to manage auth transitions
  const startAuthTransition = (operation: AuthTransitionState['operation']) => {
    setAuthTransition({
      isTransitioning: true,
      operation,
      startTime: Date.now()
    });
  };

  const endAuthTransition = () => {
    setAuthTransition({
      isTransitioning: false,
      operation: 'none',
      startTime: null
    });
  };

  // Modify AppState listener to respect auth transitions
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && 
          user && 
          healthPermissionStatus === 'granted' && 
          !authTransition.isTransitioning) {
        const refreshProviders = async () => {
          try {
            console.log('[AuthProvider] App became active, refreshing health provider...');
            const provider = await HealthProviderFactory.getProvider(undefined, user.id);
            
            if (!healthInitState.isInitialized) {
              setHealthInitState(prev => ({
                ...prev,
                isInitialized: true,
                error: null
              }));
            }
            
            await provider.resetState();
            await provider.getMetrics();
            
          } catch (error) {
            console.error('[AuthProvider] Error refreshing health provider:', error);
            setHealthInitState(prev => ({
              ...prev,
              error: error instanceof Error ? error : new Error('Failed to refresh health provider')
            }));
            
            if (error instanceof Error && error.message.includes('not initialized')) {
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
  }, [user, healthPermissionStatus, healthInitState.isInitialized, authTransition.isTransitioning]);

  // Modify login to handle transitions
  const login = async (email: string, password: string) => {
    try {
      startAuthTransition('login');
      setError(null);
      setLoading(true);
      setHealthInitState(prev => ({ ...prev, isInitializing: true, error: null }));

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      // Add delay to allow ongoing operations to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const provider = await HealthProviderFactory.getProvider();
      const permissionState = await provider.checkPermissionsStatus();
      setHealthPermissionStatus(permissionState.status);

      if (permissionState.status === 'granted') {
        await provider.initialize();
        setHealthInitState({
          isInitialized: true,
          isInitializing: false,
          error: null
        });
      } else {
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
      // Add delay before ending transition
      await new Promise(resolve => setTimeout(resolve, 500));
      endAuthTransition();
    }
  };

  // Modify logout to handle transitions
  const logout = async () => {
    try {
      startAuthTransition('logout');
      setError(null);
      setLoading(true);

      // First cleanup health provider if it exists
      if (user) {
        try {
          const provider = await HealthProviderFactory.getProvider();
          // Add delay to allow ongoing syncs to complete
          await new Promise(resolve => setTimeout(resolve, 500));
          await provider.cleanup();
        } catch (healthError) {
          console.error('[AuthProvider] Error cleaning up health provider:', healthError);
          // Continue with logout even if health cleanup fails
        }
      }

      // Perform the actual logout
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      // Clear all state
      setSession(null);
      setUser(null);
      setHealthPermissionStatus(null);
      setHealthInitState({
        isInitialized: false,
        isInitializing: false,
        error: null
      });
      
    } catch (err) {
      console.error('[AuthProvider] Logout error:', err);
      // If we get a permission error, still clear the local state
      if (err instanceof Error && err.message.includes('42501')) {
        setSession(null);
        setUser(null);
        setHealthPermissionStatus(null);
      }
      setError(mapAuthError(err));
    } finally {
      // Add delay before ending transition
      await new Promise(resolve => setTimeout(resolve, 500));
      setLoading(false);
      endAuthTransition();
    }
  };

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
   * Check if the user needs to set up health permissions
   */
  const needsHealthSetup = (): boolean => {
    return !healthPermissionStatus || healthPermissionStatus === 'not_determined';
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
    authTransition,
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
