import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/src/services/supabaseClient';
import { PermissionStatus } from '@/src/providers/health/types/permissions';
import { initializeHealthProviderForUser } from '../utils/healthInitUtils';
import { mapAuthError } from '../utils/errorUtils';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';
import { leaderboardService } from '@/src/services/leaderboardService';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { navigationQueue } from '@/src/utils/NavigationUtils';
import { useNavigationReady } from '@/src/contexts/NavigationReadyContext';

// Add health data initialization state
interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  healthPermissionStatus: PermissionStatus | null;
  healthDataInitialized: boolean; // New state to track health data initialization
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

type PermissionState = { status: string } | string;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthPermissionStatus, setHealthPermissionStatus] = useState<PermissionStatus | null>(null);
  const [isAuthNavigationLocked, setIsAuthNavigationLocked] = useState(false);
  // Add new state for health data initialization
  const [healthDataInitialized, setHealthDataInitialized] = useState(false);
  
  // Update how we import and use the navigation ready state
  const { isReady: navigatorMounted, isPermissionsHandled } = useNavigationReady();

  // Track session initialization
  const sessionInitialized = useRef(false);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session ?? null);
      setUser(session?.user ?? null);
      
      // Initialize health provider if user is logged in
      if (session?.user) {
        try {
          await initializeHealthProviderForUser(session.user.id, setHealthPermissionStatus);
          
          // Pre-initialize health data for existing sessions
          const provider = HealthProviderFactory.getProvider();
          
          // Try to fetch initial metrics to ensure data will be available
          // This prevents the dashboard from showing zeros
          try {
            await provider.getMetrics();
            // Mark health data as initialized
            setHealthDataInitialized(true);
          } catch (healthDataError) {
            console.warn('[AuthProvider] Initial health data fetch error:', healthDataError);
            // Still mark as initialized even if there's an error
            // The dashboard will handle showing appropriate fallbacks
            setHealthDataInitialized(true);
          }
        } catch (initError) {
          console.error('[AuthProvider] Health provider initialization error:', initError);
          // Even on error, continue to mark initialization as complete
          setHealthDataInitialized(true);
        }
      }
      
      sessionInitialized.current = true;
      console.log('[AuthProvider] Initial session check complete. Setting loading to false');
      setLoading(false);
    });

    // Listen for session changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Reset health data initialization state on session change
      setHealthDataInitialized(false);
      
      // Handle health permissions on auth state change
      if (session?.user) {
        try {
          await initializeHealthProviderForUser(session.user.id, setHealthPermissionStatus);
          
          // Pre-initialize health data for the new session
          const provider = HealthProviderFactory.getProvider();
          
          try {
            await provider.getMetrics();
            // Mark health data as initialized
            setHealthDataInitialized(true);
          } catch (healthDataError) {
            console.warn('[AuthProvider] Health data fetch error on auth change:', healthDataError);
            // Still mark as initialized to avoid blocking the UI
            setHealthDataInitialized(true);
          }
        } catch (error) {
          console.error('[AuthProvider] Health init error on auth change:', error);
          // Mark as initialized even on error
          setHealthDataInitialized(true);
        }
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

  // Wait for navigator to be ready before processing initial navigation
  useEffect(() => {
    if (navigatorMounted && sessionInitialized.current && !loading) {
      console.log('[AuthProvider] Navigator mounted and session initialized - processing any pending navigation');
      navigationQueue.processAllQueued();
    }
  }, [navigatorMounted, loading]);

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
            deviceType: profile.deviceType, // Keep original value in auth metadata
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

      // Handle avatar selection if provided
      if (data.user && profile.avatarUri) {
        try {
          // For numeric avatar index, use it directly
          await leaderboardService.updateUserProfile(data.user.id, {
            avatar_url: profile.avatarUri
          });
          console.log('[AuthProvider] Avatar selection saved');
        } catch (updateError) {
          console.error('[AuthProvider] Avatar update failed:', updateError);
          // Continue even if avatar update fails
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
        
        // Auto-request permissions during registration instead of waiting for health-setup
        try {
          const permissionStatus = await Promise.race([
            provider.requestPermissions(),
            new Promise<PermissionStatus>((resolve) => setTimeout(() => resolve('not_determined'), 5000))
          ]);
          
          console.log('[AuthProvider] Health permissions requested during registration:', permissionStatus);
          setHealthPermissionStatus(permissionStatus); // Update state immediately
          
          // Continue initializing even if permission request times out
          await initializeHealthProviderForUser(data.user.id, setHealthPermissionStatus);
          console.log('[AuthProvider] Health provider initialized successfully');
          
          // NEW: Fetch initial metrics to ensure data is available
          try {
            await provider.getMetrics();
            setHealthDataInitialized(true);
          } catch (metricsError) {
            console.warn('[AuthProvider] Error fetching initial metrics:', metricsError);
            // Mark as initialized anyway to prevent blocking
            setHealthDataInitialized(true);
          }
        } catch (healthPermissionError) {
          console.error('[AuthProvider] Error requesting health permissions:', healthPermissionError);
          // Don't block registration on health provider errors
          // Mark health data as initialized to avoid blocking the UI
          setHealthDataInitialized(true);
        }
        
        console.log('[AuthProvider] Registration process completed successfully');
      } catch (healthError) {
        console.error('[AuthProvider] Error initializing health provider:', healthError);
        // Don't block registration on health provider errors
        // Mark health data as initialized to avoid blocking the UI
        setHealthDataInitialized(true);
      }
      
      // Add delay before navigation to ensure navigator is mounted
      console.log('[AuthProvider] Adding delay before navigation after registration');
      await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay for stability

      // Ensure health data is always initialized
      setHealthDataInitialized(true);
      
      // Log navigation state for debugging
      console.log('[AuthProvider] Registration complete, navigation state:', {
        navigatorMounted,
        healthDataInitialized: true,
        sessionInitialized: sessionInitialized.current
      });

      // Create a safety timeout to force navigation if other methods fail
      const forceNavigationTimeout = setTimeout(() => {
        console.log('[AuthProvider] Forcing navigation due to timeout');
        router.replace('/(app)/(home)');
      }, 2000);

      // Try normal navigation first
      if (navigatorMounted) {
        console.log('[AuthProvider] Navigator mounted, proceeding with direct navigation');
        router.replace('/(app)/(home)');
        clearTimeout(forceNavigationTimeout);
      } else {
        console.log('[AuthProvider] Navigator not mounted, queueing navigation');
        navigationQueue.enqueue('/(app)/(home)', 10);
        // Keep the timeout as backup
      }
      
    } catch (err) {
      console.error('[AuthProvider] Registration error:', err);
      const mappedError = mapAuthError(err);
      setError(mappedError);
      // Mark health data as initialized to prevent blocking the UI
      setHealthDataInitialized(true);
      throw err; // Re-throw to allow caller to handle
    } finally {
      setLoading(false);
      setIsAuthNavigationLocked(false); // Unlock navigation
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
      setIsAuthNavigationLocked(true); // Lock navigation
      setHealthDataInitialized(false); // Reset health data initialization

      console.log('[AuthProvider] Starting login attempt...');
      
      // Attempt login
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      console.log('[AuthProvider] Login successful, initializing health provider...');
      
      // After successful login, initialize health provider and data
      const provider = HealthProviderFactory.getProvider();
      try {
        // First initialize the health provider and permissions
        await provider.safeInitialize(user?.id || 'default-user-id');
        
        // Then attempt to fetch initial metrics
        try {
          await provider.getMetrics();
          setHealthDataInitialized(true);
          console.log('[AuthProvider] Initial health data loaded successfully');
        } catch (metricsError) {
          console.warn('[AuthProvider] Error loading initial health data:', metricsError);
          // Mark as initialized anyway to prevent blocking
          setHealthDataInitialized(true);
        }
      } catch (healthErr) {
        console.warn('[AuthProvider] Health initialization error:', healthErr);
        // Mark as initialized even on errors
        setHealthDataInitialized(true);
      }

      // Add delay before navigation to ensure navigator is mounted
      console.log('[AuthProvider] Adding delay before navigation after login');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Update navigation checks in login function
      if (navigatorMounted && healthDataInitialized) {
        console.log('[AuthProvider] Navigator mounted and health data initialized, proceeding with direct navigation');
        router.replace('/(app)/(home)');
      } else {
        console.log('[AuthProvider] Navigator not mounted or health data not initialized, queueing navigation');
        navigationQueue.enqueue('/(app)/(home)', 10);
      }

    } catch (err) {
      console.error('[AuthProvider] Login error:', err);
      setError(mapAuthError(err));
      // Ensure health data is marked as initialized even on errors
      setHealthDataInitialized(true);
    } finally {
      // Use a short delay before unlocking navigation to prevent immediate re-navigation
      setTimeout(() => {
        setLoading(false);
        setIsAuthNavigationLocked(false); // Unlock navigation
        console.log('[AuthProvider] Login process complete. Navigation unlocked.');
      }, 100);
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
      setHealthDataInitialized(false);

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
      
      // Add delay before navigation to ensure navigator is mounted
      console.log('[AuthProvider] Adding delay before navigation after logout');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Update navigation checks in logout function
      if (navigatorMounted) {
        console.log('[AuthProvider] Navigator is mounted, proceeding with direct navigation');
        router.replace('/(auth)/login');
      } else {
        console.log('[AuthProvider] Navigator not mounted, queueing navigation');
        navigationQueue.enqueue('/(auth)/login', 10);
      }
      
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

    const PERMISSION_TIMEOUT = 6000; // 6 seconds
    
    // Update permission request logic to consider isPermissionsHandled
    if (!navigatorMounted || !isPermissionsHandled) {
      console.log('[AuthProvider] Waiting for navigator and permissions to be ready');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      setError(null);
      setLoading(true);
      setHealthDataInitialized(false);

      const provider = HealthProviderFactory.getProvider();
      
      // Ensure provider is properly initialized with permissions
      try {
        await provider.initializeWithPermissions(user.id);
      } catch (initError) {
        console.error('[AuthProvider] Error initializing health provider:', initError);
        throw initError;
      }
      
      // Create timeout promise with explicit rejection
      const timeoutPromise = new Promise<PermissionStatus>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          console.warn('[AuthProvider] Permission request timed out after', PERMISSION_TIMEOUT, 'ms');
          resolve('not_determined');
        }, PERMISSION_TIMEOUT);
        
        // Cleanup timeout if promise is completed before timeout
        return () => clearTimeout(timeoutId);
      });
      
      // Race between permission request and timeout
      const status = await Promise.race([
        provider.requestPermissions(),
        timeoutPromise
      ]);
      
      console.log('[AuthProvider] Permission request completed with status:', status);
      setHealthPermissionStatus(status);
      
      // Try to fetch initial metrics after permissions are granted
      if (status === 'granted') {
        try {
          await provider.getMetrics();
          setHealthDataInitialized(true);
        } catch (metricsError) {
          console.warn('[AuthProvider] Error loading metrics after permission grant:', metricsError);
          // Mark as initialized anyway
          setHealthDataInitialized(true);
        }
      } else {
        // Even with denied permissions, mark as initialized
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
      // Mark as initialized even on errors
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
    healthDataInitialized, // Expose this state to consumers
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