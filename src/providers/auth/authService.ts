import { AuthResponse } from '@supabase/supabase-js';
import { supabase } from '@/src/services/supabaseClient';
import { leaderboardService } from '@/src/services/leaderboardService';
import { RegisterProfileData } from './types';
import NetInfo from '@react-native-community/netinfo';

const TIMEOUT_MS = 10000; // 10 seconds
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second base delay

// Check if network is available
async function checkNetwork(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}

// Exponential backoff delay
function getRetryDelay(attempt: number): number {
  return Math.min(BASE_DELAY * Math.pow(2, attempt), 8000); // Max 8 second delay
}

// Enhanced retry wrapper with network check
async function withRetry<T>(
  operation: () => Promise<T>,
  name: string,
  retryCount = 0
): Promise<T> {
  try {
    // Check network before attempting operation
    const isConnected = await checkNetwork();
    if (!isConnected) {
      throw new Error('No internet connection available');
    }

    const operationPromise = operation();
    const timeoutPromise = new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${name} operation timed out`)), TIMEOUT_MS)
    );

    return Promise.race([operationPromise, timeoutPromise]);
  } catch (error) {
    if (retryCount < MAX_RETRIES && (
      error instanceof Error && (
        error.message.includes('Network request failed') ||
        error.message.includes('timed out') ||
        error.message.includes('No internet connection')
      )
    )) {
      const delay = getRetryDelay(retryCount);
      console.log(`[authService] ${name} attempt ${retryCount + 1}/${MAX_RETRIES} failed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, name, retryCount + 1);
    }
    throw error;
  }
}

async function loginWithRetry(email: string, password: string): Promise<any> {
  return withRetry(
    async () => {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('No session returned from login');
      return data;
    },
    'Login'
  );
}

/**
 * Register a new user with Supabase and create their profile
 */
export async function registerUser(
  email: string,
  password: string,
  profile: RegisterProfileData
) {
  // Validate display name
  if (!profile.displayName?.trim()) {
    throw new Error('Display name is required');
  }

  // First attempt to sign up - only include critical metadata
  console.log('[authService] Registering user with Supabase...');
  const signUpData = {
    email,
    password,
    options: {
      data: {
        displayName: profile.displayName.trim(),
      },
    },
  };
  
  // Attempt to register the user
  const { data, error } = await supabase.auth.signUp(signUpData);
  
  if (error) {
    console.error('[authService] Registration error with Supabase:', error);
    throw error;
  }
  
  if (!data.user) {
    console.error('[authService] Registration completed but no user returned');
    throw new Error('Registration failed: No user data returned');
  }
  
  console.log('[authService] User registered successfully with ID:', data.user.id);
  
  // Update the user metadata with additional fields
  try {
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        deviceType: profile.deviceType,
        measurementSystem: profile.measurementSystem,
        showProfile: profile.showProfile ?? true
      }
    });
    
    if (metadataError) {
      console.warn('[authService] Failed to update user metadata:', metadataError);
    }
  } catch (metadataError) {
    console.warn('[authService] Error updating user metadata:', metadataError);
  }
  
  // Create profile through the API
  try {
    console.log('[authService] Creating user profile...');
    await leaderboardService.createUserProfile(data.user.id, {
      display_name: profile.displayName.trim(),
      device_type: profile.deviceType,
      measurement_system: profile.measurementSystem,
      show_profile: profile.showProfile ?? true,
    });
    
    console.log('[authService] Initial profile created successfully');
  } catch (profileError) {
    console.error('[authService] Error creating initial profile:', profileError);
  }

  // Handle avatar selection if provided
  if (data.user && profile.avatarUri) {
    try {
      await leaderboardService.updateUserProfile(data.user.id, {
        avatar_url: profile.avatarUri
      });
      console.log('[authService] Avatar selection saved');
    } catch (updateError) {
      console.error('[authService] Avatar update failed:', updateError);
    }
  }

  return data.user;
}

/**
 * Login a user with email and password
 */
export async function loginUser(email: string, password: string) {
  console.log('[authService] Starting login attempt...');
  try {
    const data = await loginWithRetry(email, password);
    console.log('[authService] Login successful');
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Network request failed')) {
      throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
    }
    throw error;
  }
}

/**
 * Sign out the current user
 */
export async function logoutUser() {
  console.log('[authService] Logging out user...');
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) throw signOutError;
  console.log('[authService] User logged out successfully');
}

/**
 * Auto-login after registration
 */
export async function autoLogin(email: string, password: string) {
  console.log('[authService] Attempting auto-login...');
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  }) as AuthResponse;
  
  if (signInError) {
    throw signInError;
  }
  
  console.log('[authService] Auto-login successful');
} 