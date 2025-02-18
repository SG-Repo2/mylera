import { HealthMetrics } from '@/src/providers/health/types';
import { PermissionStatus } from '@/src/providers/health/types/permissions';
import { User, Session, UserMetadata, UserAppMetadata } from '@supabase/supabase-js';

export interface TestUserMetadata extends UserMetadata {
  displayName: string;
  deviceType: 'ios' | 'android' | 'web';
  measurementSystem: 'metric' | 'imperial';
  avatarUrl?: string;
}

export interface TestAppMetadata extends UserAppMetadata {
  provider?: string;
}

export interface TestUser extends Omit<User, 'user_metadata' | 'app_metadata'> {
  user_metadata: TestUserMetadata;
  app_metadata: TestAppMetadata;
}

export interface TestSession extends Omit<Session, 'user'> {
  user: TestUser;
}

/**
 * Test health data interface for mocking health metrics
 */
export interface TestHealthData extends Partial<HealthMetrics> {
  user_id: string;
  date: string;
  steps?: number;
  distance?: number;
  calories?: number;
  heart_rate?: number;
  exercise?: number;
  daily_score?: number;
}

/**
 * Test permission state for mocking health provider permissions
 */
export interface TestPermissionState {
  status: PermissionStatus;
  lastChecked: number;
  deniedPermissions?: string[];
}

/**
 * Test error response interface
 */
export interface TestErrorResponse {
  error: Error;
  status?: number;
  code?: string;
}

/**
 * Test success response interface
 */
export interface TestSuccessResponse<T> {
  data: T;
  error: null;
}

/**
 * Test response type combining success and error responses
 */
export type TestResponse<T> = TestSuccessResponse<T> | TestErrorResponse;

/**
 * Test provider configuration interface
 */
export interface TestProviderConfig {
  initialAuth?: {
    user: TestUser;
    session: TestSession;
  };
  mockHealthData?: TestHealthData;
  mockPermissions?: TestPermissionState;
  mockError?: TestErrorResponse;
}

/**
 * Test component wrapper props interface
 */
export interface TestWrapperProps {
  children: React.ReactNode;
  config?: TestProviderConfig;
}

/**
 * Test render options extending React Testing Library options
 */
export interface TestRenderOptions {
  config?: TestProviderConfig;
  renderOptions?: Omit<import('@testing-library/react-native').RenderOptions, 'wrapper'>;
}
