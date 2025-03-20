import { Dispatch, SetStateAction } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/src/services/supabaseClient';
import { PermissionStatus } from '@/src/providers/health/types/permissions';
import { AuthState } from './types';

/**
 * Initialize auth state with defaults
 */
export function initializeAuthState(): AuthState {
  return {
    session: null,
    user: null,
    loading: true,
    error: null,
    healthPermissionStatus: null,
    healthDataInitialized: false,
    isAuthNavigationLocked: false
  };
}

/**
 * Set up auth state change listener
 */
export function setupAuthStateListener(
  setSession: Dispatch<SetStateAction<Session | null>>,
  setUser: Dispatch<SetStateAction<User | null>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
  setHealthDataInitialized: Dispatch<SetStateAction<boolean>>,
  setHealthPermissionStatus: Dispatch<SetStateAction<PermissionStatus | null>>,
  onSessionChange: (session: Session | null) => void
) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    setSession(session);
    setUser(session?.user ?? null);
    
    // Reset health data initialization state on session change
    setHealthDataInitialized(false);
    
    // If session is null (logged out), reset health permissions
    if (!session) {
      setHealthPermissionStatus(null);
    }
    
    // Call the session change callback
    await onSessionChange(session);
    
    console.log('[authState] Auth state changed:', { session, user: session?.user });
    setLoading(false);
  });

  return subscription;
}

/**
 * Check and update the initial session
 */
export async function checkInitialSession(
  setSession: Dispatch<SetStateAction<Session | null>>,
  setUser: Dispatch<SetStateAction<User | null>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
  onSessionFound: (session: Session) => Promise<void>
) {
  const { data: { session } } = await supabase.auth.getSession();
  
  setSession(session ?? null);
  setUser(session?.user ?? null);
  
  if (session?.user) {
    await onSessionFound(session);
  }
  
  console.log('[authState] Initial session check complete');
  setLoading(false);
  
  return session;
} 