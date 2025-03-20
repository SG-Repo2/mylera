import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import NetInfo from '@react-native-community/netinfo';

// Use environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file.');
}

// Network state check function
export const checkNetworkConnection = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable;
};

// Custom fetch implementation with timeout
const customFetch = async (url: RequestInfo | URL, options: RequestInit = {}) => {
  try {
    // Check network connection before making request
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      throw new Error('No internet connection available');
    }

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    // Ensure headers object exists and include the apikey
    const headers = {
      ...options.headers,
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    };

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Network request timed out. Please try again.');
      }
      if (error.message.includes('network request failed')) {
        throw new Error('Network request failed. Please check your internet connection.');
      }
    }
    throw error;
  }
};

const customHeaders = {
  'X-Client-Info': 'react-native',
  'X-Custom-Fetch': 'react-native',
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: customHeaders,
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  }
});

// @ts-ignore - Override internal fetch implementation
supabase.rest.fetch = customFetch;