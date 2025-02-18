import React, { createContext, useContext, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { PermissionStatus } from '@/src/providers/health/types/permissions';

// Custom error types
class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthValidationError';
  }
}

class AuthStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthStateError';
  }
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: Error | null;
  healthPermissionStatus: PermissionStatus | null;
  register: (email: string, password: string, profileData?: Record<string, unknown>) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  requestHealthPermissions: () => Promise<PermissionStatus>;
  needsHealthSetup: () => boolean;
  clearError: () => void;
  refreshSession: () => Promise<void>;
}

// Validation rules
const authValidation = {
  email: (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AuthValidationError('Invalid email format');
    }
  },
  password: (password: string) => {
    if (password.length < 8) {
      throw new AuthValidationError('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw new AuthValidationError('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new AuthValidationError('Password must contain at least one number');
    }
  },
  profileData: (data: Record<string, unknown>) => {
    if (!data.displayName || typeof data.displayName !== 'string') {
      throw new AuthValidationError('Display name is required');
    }
    if (!data.deviceType || !['ios', 'android', 'web'].includes(data.deviceType as string)) {
      throw new AuthValidationError('Valid device type is required');
    }
  }
};

const MockAuthContext = createContext<AuthContextType | undefined>(undefined);

// Default mock user and session
const defaultMockUser: User = {
  id: 'test-user-id',
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'test@example.com',
  role: 'authenticated',
  user_metadata: {
    displayName: 'Test User',
    deviceType: 'ios',
    measurementSystem: 'metric'
  },
  app_metadata: {
    provider: 'email'
  }
};

const defaultMockSession: Session = {
  access_token: 'mock-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock-refresh-token',
  user: defaultMockUser,
  expires_at: Math.floor(Date.now() / 1000) + 3600
};

interface MockAuthProviderProps {
  children: React.ReactNode;
  initialState?: {
    user: User | null;
    session: Session | null;
  };
}

// Extend FC type to include error classes
interface MockAuthProviderComponent extends React.FC<MockAuthProviderProps> {
  AuthValidationError: typeof AuthValidationError;
  AuthStateError: typeof AuthStateError;
}

// Mock provider with enhanced error handling and validation
export const MockAuthProvider: MockAuthProviderComponent = Object.assign(
  ({ 
  children, 
  initialState = { user: defaultMockUser, session: defaultMockSession }
}: MockAuthProviderProps) => {
  // State management
  const [session, setSession] = useState<Session | null>(initialState.session);
  const [user, setUser] = useState<User | null>(initialState.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [healthPermissionStatus, setHealthPermissionStatus] = useState<PermissionStatus>('not_determined');

  const register = jest.fn().mockImplementation(async (
    email: string,
    password: string,
    profileData?: Record<string, unknown>
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      // Validate inputs
      authValidation.email(email);
      authValidation.password(password);
      if (profileData) {
        authValidation.profileData(profileData);
      }

      // Check if email is already registered
      if (email === 'existing@example.com') {
        throw new AuthValidationError('Email already registered');
      }

      // Create new user with provided data
      const newUser: User = {
        ...defaultMockUser,
        email,
        user_metadata: {
          ...defaultMockUser.user_metadata,
          ...profileData
        }
      };

      // Create new session for the user
      const newSession: Session = {
        ...defaultMockSession,
        user: newUser
      };

      // Update state
      setSession(newSession);
      setUser(newUser);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Registration failed'));
      throw err;
    } finally {
      setLoading(false);
    }
  });

  const login = jest.fn().mockImplementation(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Validate inputs
      authValidation.email(email);
      authValidation.password(password);

      // Check credentials
      if (password === 'wrongpassword') {
        throw new AuthValidationError('Invalid credentials');
      }

      // Simulate successful login
      setSession(initialState.session);
      setUser(initialState.user);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Login failed'));
      throw err;
    } finally {
      setLoading(false);
    }
  });

  const logout = jest.fn().mockImplementation(async () => {
    setLoading(true);
    try {
      // Simulate successful logout
      setSession(null);
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Logout failed'));
      throw err;
    } finally {
      setLoading(false);
    }
  });

  const requestHealthPermissions = jest.fn().mockImplementation(async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if user is authenticated
      if (!session || !user) {
        throw new AuthStateError('User must be authenticated to request health permissions');
      }

      // Simulate platform-specific permission request
      const deviceType = user.user_metadata.deviceType;
      if (deviceType === 'ios' || deviceType === 'android') {
        setHealthPermissionStatus('granted');
        return 'granted' as PermissionStatus;
      } else {
        throw new Error('Health permissions not supported on this platform');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Health permissions request failed'));
      setHealthPermissionStatus('denied');
      return 'denied' as PermissionStatus;
    } finally {
      setLoading(false);
    }
  });

  const clearError = () => {
    setError(null);
  };

  const refreshSession = jest.fn().mockImplementation(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!session) {
        throw new AuthStateError('No active session to refresh');
      }

      // Simulate session refresh
      setSession({
        ...session,
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Session refresh failed'));
      throw err;
    } finally {
      setLoading(false);
    }
  });

  const needsHealthSetup = jest.fn().mockImplementation(() => {
    return healthPermissionStatus === 'not_determined';
  });

  const value: AuthContextType = {
    session,
    user,
    loading,
    error,
    healthPermissionStatus,
    register,
    login,
    logout,
    requestHealthPermissions,
    needsHealthSetup,
    clearError,
    refreshSession
  };

  // Export error classes for testing
  MockAuthProvider.AuthValidationError = AuthValidationError;
  MockAuthProvider.AuthStateError = AuthStateError;

  return <MockAuthContext.Provider value={value}>{children}</MockAuthContext.Provider>;
}, {
  AuthValidationError,
  AuthStateError
});

// Export error classes directly
export { AuthValidationError, AuthStateError };

export const useMockAuth = () => {
  const context = useContext(MockAuthContext);
  if (context === undefined) {
    throw new Error('useMockAuth must be used within a MockAuthProvider');
  }
  return context;
};
