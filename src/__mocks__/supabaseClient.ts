import { Session, User } from '@supabase/supabase-js';
import type { SpyInstance } from 'jest-mock';

// Mock user data
const mockUser: User = {
  id: 'test-user-id',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'test@example.com',
  role: 'authenticated',
};

// Mock session data
const mockSession: Session = {
  access_token: 'mock-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock-refresh-token',
  user: mockUser,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

type MockFn = SpyInstance & {
  mockReturnThis: () => MockFn;
  mockResolvedValue: (value: any) => MockFn;
  mockResolvedValueOnce: (value: any) => MockFn;
  mockRejectedValueOnce: (value: any) => MockFn;
};

const createMockFn = (): MockFn => {
  const fn = global.jest.fn() as unknown as MockFn;
  fn.mockReturnThis = () => fn;
  fn.mockResolvedValue = (value: any) => {
    fn.mockImplementation(() => Promise.resolve(value));
    return fn;
  };
  fn.mockResolvedValueOnce = (value: any) => {
    fn.mockImplementationOnce(() => Promise.resolve(value));
    return fn;
  };
  fn.mockRejectedValueOnce = (value: any) => {
    fn.mockImplementationOnce(() => Promise.reject(value));
    return fn;
  };
  return fn;
};

// Create mock Supabase client
export const supabase = {
  auth: {
    getSession: createMockFn().mockResolvedValue({ data: { session: mockSession } }),
    signUp: createMockFn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    signInWithPassword: createMockFn().mockResolvedValue({ data: { session: mockSession }, error: null }),
    signOut: createMockFn().mockResolvedValue({ error: null }),
    onAuthStateChange: createMockFn().mockReturnValue({
      data: { subscription: { unsubscribe: createMockFn() } }
    }),
  },
  from: createMockFn().mockReturnValue({
    select: createMockFn().mockReturnThis(),
    insert: createMockFn().mockReturnThis(),
    update: createMockFn().mockReturnThis(),
    delete: createMockFn().mockReturnThis(),
    eq: createMockFn().mockReturnThis(),
    single: createMockFn().mockResolvedValue({ data: null, error: null }),
  }),
};

// Helper to reset all mocks between tests
export const resetSupabaseMocks = () => {
  Object.values(supabase.auth).forEach(mock => {
    if (typeof mock === 'function') {
      (mock as MockFn).mockClear();
    }
  });
};

// Helper to simulate auth errors
export const simulateAuthError = (method: keyof typeof supabase.auth, error: any) => {
  const mock = supabase.auth[method];
  if (typeof mock === 'function') {
    (mock as MockFn).mockRejectedValueOnce(error);
  }
};

// Helper to simulate database responses
export const simulateDbResponse = (data: any) => {
  const fromMock = supabase.from as unknown as () => {
    select: () => { single: () => MockFn };
  };
  fromMock().select().single().mockResolvedValueOnce({ data, error: null });
};
