import { TestUser, TestSession, TestHealthData, TestPermissionState, TestErrorResponse, TestSuccessResponse, TestUserMetadata, TestAppMetadata } from '../types/test.types';
import { HealthProvider, RawHealthData, NormalizedMetric } from '@/src/providers/health/types';
import { PermissionManager } from '@/src/providers/health/types/permissions';
import { MetricType } from '@/src/types/metrics';

export class MockFactory {
  /**
   * Create a mock test user
   */
  static createTestUser(overrides: Partial<TestUser> = {}): TestUser {
    const now = new Date().toISOString();
    return {
      id: 'test-user-123',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@example.com',
      email_confirmed_at: now,
      phone: '',
      phone_confirmed_at: null,
      confirmed_at: now,
      last_sign_in_at: now,
      user_metadata: {
        displayName: 'Test User',
        deviceType: 'ios',
        measurementSystem: 'metric'
      } as TestUserMetadata,
      app_metadata: {
        provider: 'email'
      } as TestAppMetadata,
      created_at: now,
      updated_at: now,
      identities: [],
      factors: [],
      ...overrides
    } as TestUser;
  }

  /**
   * Create a mock test session
   */
  static createTestSession(user: TestUser, overrides: Partial<TestSession> = {}): TestSession {
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: 'mock-access-token',
      token_type: 'bearer',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      expires_at: now + 3600,
      provider_token: null,
      provider_refresh_token: null,
      user,
      ...overrides
    } as TestSession;
  }

  /**
   * Create mock health data
   */
  static createTestHealthData(userId: string, overrides: Partial<TestHealthData> = {}): TestHealthData {
    return {
      user_id: userId,
      date: new Date().toISOString().split('T')[0],
      steps: 10000,
      distance: 8000,
      calories: 2500,
      heart_rate: 72,
      exercise: 45,
      daily_score: 85,
      ...overrides
    };
  }

  /**
   * Create a mock permission state
   */
  static createTestPermissionState(overrides: Partial<TestPermissionState> = {}): TestPermissionState {
    return {
      status: 'granted',
      lastChecked: Date.now(),
      ...overrides
    };
  }

  /**
   * Create a mock health provider
   */
  static createTestHealthProvider(config: {
    healthData?: TestHealthData;
    permissionState?: TestPermissionState;
  } = {}): HealthProvider {
    const { healthData, permissionState } = config;
    
    return {
      initialize: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
      initializePermissions: jest.fn().mockResolvedValue(undefined),
      requestPermissions: jest.fn().mockResolvedValue('granted'),
      checkPermissionsStatus: jest.fn().mockResolvedValue(
        permissionState || MockFactory.createTestPermissionState()
      ),
      handlePermissionDenial: jest.fn().mockResolvedValue(undefined),
      getPermissionManager: jest.fn(() => new PermissionManager('test-user-123')),
      fetchRawMetrics: jest.fn().mockResolvedValue({}),
      normalizeMetrics: jest.fn().mockReturnValue([]),
      getMetrics: jest.fn().mockResolvedValue(
        healthData || MockFactory.createTestHealthData('test-user-123')
      ),
      isAvailable: jest.fn().mockResolvedValue(true),
      getLastSyncTime: jest.fn().mockResolvedValue(new Date()),
      setLastSyncTime: jest.fn().mockResolvedValue(undefined)
    };
  }

  /**
   * Create a mock error response
   */
  static createTestErrorResponse(message: string, status = 400, code = 'ERROR'): TestErrorResponse {
    return {
      error: new Error(message),
      status,
      code
    };
  }

  /**
   * Create a mock success response
   */
  static createTestSuccessResponse<T>(data: T): TestSuccessResponse<T> {
    return {
      data,
      error: null
    };
  }

  /**
   * Create mock raw health data
   */
  static createTestRawHealthData(): RawHealthData {
    return {
      steps: [{
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        value: 10000,
        unit: 'count'
      }],
      distance: [{
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        value: 8000,
        unit: 'meters'
      }],
      calories: [{
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        value: 2500,
        unit: 'kcal'
      }]
    };
  }

  /**
   * Create a mock normalized metric
   */
  static createTestNormalizedMetric(type: MetricType, value: number): NormalizedMetric {
    return {
      timestamp: new Date().toISOString(),
      value,
      unit: 'count',
      type,
      confidence: 1
    };
  }
}
