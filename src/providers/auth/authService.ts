import { AuthResponse } from '@supabase/supabase-js';
import { supabase } from '@/src/services/supabaseClient';
import { mapAuthError } from '@/src/utils/errorUtils';
import { leaderboardService } from '@/src/services/leaderboardService';
import { RegisterProfileData } from './types';

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
  
  const { error: signInError, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  }) as AuthResponse;
  
  if (signInError) throw signInError;
  if (!data.session) throw new Error('No session returned from login');
  
  console.log('[authService] Login successful');
  return data;
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