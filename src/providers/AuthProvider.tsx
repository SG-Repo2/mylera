/**
 * Key points:
	•	We store both session and user to manage app logic that might require more than a session token.
	•	The loading state helps display UI feedback (e.g., spinners) while auth actions are in progress.
	•	The error state is updated when any registration, login, or logout operation fails.
	•	We expose register, login, and logout for the rest of the app to consume.
 */
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/src/services/supabaseClient';
import { PermissionStatus } from './health/types/permissions';
import { initializeHealthProviderForUser, type ProviderInitializationState } from '../utils/healthInitUtils';
import { mapAuthError } from '../utils/errorUtils';
import { HealthProviderFactory } from './health/factory/HealthProviderFactory';
import { leaderboardService } from '@/src/services/leaderboardService';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  healthPermissionStatus: PermissionStatus | null;
  healthInitState: ProviderInitializationState;
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
  const [healthInitState, setHealthInitState] = useState<ProviderInitializationState>({
    isInitialized: false,
    isInitializing: false,
    permissionStatus: 'not_determined',
    error: null
  });

  // Add operation tracking
  const [currentOperationId, setCurrentOperationId] = useState<number>(0);

  // Add initialization lock
  const initializationLock = useRef<Promise<void> | null>(null);

  // Handle app lifecycle for health provider state management
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && user && healthPermissionStatus === 'granted') {
        // App returning to foreground - refresh state
        const refreshProviders = async () => {
          try {
            console.log('[AuthProvider] App became active, refreshing health provider...');
            
            if (!user) {
              throw new Error('No user available for provider refresh');
            }

            await initializeHealthProviderForUser(
              user.id,
              setHealthPermissionStatus,
              (state) => setHealthInitState(state)
            );
            
            // If initialization successful, refresh metrics
            if (healthInitState.isInitialized) {
              const provider = await HealthProviderFactory.getProvider(undefined, user.id);
              await provider.getMetrics();
            }
            
            console.log('[AuthProvider] Health provider refresh completed successfully');
          } catch (error) {
            console.error('[AuthProvider] Error refreshing health provider:', error);
            setHealthInitState(prev => ({
              ...prev,
              isInitialized: false,
              error: error instanceof Error ? error : new Error('Failed to refresh health provider')
            }));
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
    // Modify initializeHealthProviderForUser call in useEffect
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[AuthProvider] Initial session check:', { hasSession: !!session });
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Ensure only one initialization is running
          if (initializationLock.current) {
            await initializationLock.current;
            return;
          }

          initializationLock.current = (async () => {
            try {
              await initializeHealthProviderForUser(
                session.user.id,
                setHealthPermissionStatus,
                setHealthInitState
              );
            } finally {
              initializationLock.current = null;
            }
          })();
          
          await initializationLock.current;
        }
      } catch (error) {
        console.error('[AuthProvider] Initialization error:', error);
        setHealthPermissionStatus('denied');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
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

      setSession(session);
      setUser(session?.user ?? null);
      console.log(`[AuthProvider] [${operationId}] Session state updated`);
      
      try {
        if (!session?.user) {
          console.log(`[AuthProvider] [${operationId}] No user session, cleaning up...`);
          setHealthPermissionStatus(null);
          setHealthInitState({
            isInitialized: false,
            isInitializing: false,
            permissionStatus: 'not_determined',
            error: null
          });
          
          await HealthProviderFactory.cleanup();
          console.log(`[AuthProvider] [${operationId}] Provider cleanup completed`);
        } else {
          console.log(`[AuthProvider] [${operationId}] Initializing health provider for user:`, session.user.id);
          
          try {
            await initializeHealthProviderForUser(
              session.user.id,
              setHealthPermissionStatus,
              (state) => setHealthInitState(state)
            );
            console.log(`[AuthProvider] [${operationId}] Health provider initialized successfully`);
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
    console.log('[AuthProvider] register - Start', { email, displayName: profile.displayName });
    try {
      setError(null);
      setLoading(true);

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

      if (data.user) {
        await initializeHealthProviderForUser(
          data.user.id,
          setHealthPermissionStatus,
          (state) => setHealthInitState(state)
        );
      }
    } catch (err) {
      console.error('[AuthProvider] register - Error:', err);
      setError(mapAuthError(err));
      await HealthProviderFactory.cleanup();
      setSession(null);
      setUser(null);
      setHealthPermissionStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      console.log('[AuthProvider] Starting login process...');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await initializeHealthProviderForUser(
          user.id,
          setHealthPermissionStatus,
          (state) => setHealthInitState(state)
        );
      }
    } catch (err) {
      console.error('[AuthProvider] Login error:', err);
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
      console.log('[AuthProvider] Login process completed');
    }
  };

  const needsHealthSetup = (): boolean => {
    return !healthPermissionStatus || healthPermissionStatus === 'not_determined';
  };

  const logout = async () => {
    try {
      setError(null);
      setLoading(true);

      if (user) {
        try {
          await HealthProviderFactory.cleanup();
        } catch (healthError) {
          console.error('Error cleaning up health provider:', healthError);
        }
      }

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      setSession(null);
      setUser(null);
      setHealthPermissionStatus(null);
      setHealthInitState({
        isInitialized: false,
        isInitializing: false,
        permissionStatus: 'not_determined',
        error: null
      });
      
    } catch (err) {
      console.error('Logout error:', err);
      if (err instanceof Error && err.message.includes('42501')) {
        setSession(null);
        setUser(null);
        setHealthPermissionStatus(null);
      }
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

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
      
      if (status === 'granted') {
        await initializeHealthProviderForUser(
          user.id,
          setHealthPermissionStatus,
          (state) => setHealthInitState(state)
        );
      }
      
      return status;
    } catch (err) {
      console.error('[AuthProvider] Health permissions error:', err);
      let message = 'Failed to request health permissions';
      
      if (err instanceof Error) {
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
