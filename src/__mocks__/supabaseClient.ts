import { Session, User, SupabaseClient } from '@supabase/supabase-js';
import { TestUser, TestSession, TestErrorResponse } from '@/src/__tests__/types/test.types';

// Mock user data
const mockUser: TestUser = {
  id: 'test-user-id',
  app_metadata: {
    provider: 'email',
  },
  user_metadata: {
    displayName: 'Test User',
    deviceType: 'ios',
    measurementSystem: 'metric',
  },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'test@example.com',
  role: 'authenticated',
};

// Mock session data
const mockSession: TestSession = {
  access_token: 'mock-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock-refresh-token',
  user: mockUser,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

// Realtime subscription types
interface RealtimeSubscription {
  unsubscribe: () => void;
}

interface RealtimeChannel {
  on: (event: string, callback: Function) => {
    subscribe: () => RealtimeSubscription;
  };
  subscribe: () => RealtimeSubscription;
}

// Create realtime mock
const createRealtimeMock = (): RealtimeChannel => ({
  on: jest.fn((event: string, callback: Function) => ({
    subscribe: jest.fn(() => ({
      unsubscribe: jest.fn(),
    })),
  })),
  subscribe: jest.fn(() => ({
    unsubscribe: jest.fn(),
  })),
});

// Database operation types
interface DatabaseResponse<T> {
  data: T | null;
  error: TestErrorResponse | null;
}

interface QueryBuilder<T> {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  match: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock<Promise<DatabaseResponse<T>>>;
}

// Create mock Supabase client
export const supabase = {
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: mockSession }, error: null })),
    signUp: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { session: mockSession }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
    refreshSession: jest.fn(() => Promise.resolve({ data: { session: mockSession }, error: null })),
    getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
  },
  from: jest.fn(<T>() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  } as QueryBuilder<T>)),
  channel: jest.fn((name: string): RealtimeChannel => createRealtimeMock()),
};

// Helper to reset all mocks between tests
export const resetSupabaseMocks = () => {
  Object.values(supabase.auth).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockClear();
    }
  });
  (supabase.from as jest.Mock).mockClear();
  (supabase.channel as jest.Mock).mockClear();
};

// Helper to simulate auth errors
export const simulateAuthError = (
  method: keyof typeof supabase.auth,
  error: TestErrorResponse
) => {
  const mock = supabase.auth[method] as jest.Mock;
  if (typeof mock === 'function') {
    // Cast the rejection value to any to bypass type issues
    mock.mockRejectedValueOnce({ data: null, error } as any);
  }
};

// Helper to simulate database responses
export const simulateDbResponse = <T>(data: T) => {
  (supabase.from() as QueryBuilder<T>).single.mockResolvedValueOnce({ data, error: null });
};

// Helper to simulate database errors
export const simulateDbError = (error: TestErrorResponse) => {
  (supabase.from() as QueryBuilder<unknown>).single.mockResolvedValueOnce({ data: null, error });
};

// Helper to simulate realtime events
export const simulateRealtimeEvent = (
  channelName: string,
  eventType: string,
  payload: any
) => {
  const channel = supabase.channel(channelName);
  const listeners = (channel.on as jest.Mock).mock.calls
    .filter(([event]) => event === eventType)
    .map(([_, callback]) => callback);

  listeners.forEach(callback => callback(payload));
  return listeners.length > 0;
};

// Helper to simulate realtime errors
export const simulateRealtimeError = (
  channelName: string,
  error: TestErrorResponse
) => {
  const channel = supabase.channel(channelName);
  (channel.subscribe as jest.Mock).mockRejectedValueOnce(error);
};

export type { RealtimeChannel, RealtimeSubscription, DatabaseResponse, QueryBuilder };
export { mockUser, mockSession };
