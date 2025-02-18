import { TestHealthData, TestPermissionState, TestUser, TestSession } from './test.types';
import { HealthProvider, RawHealthData } from '@/src/providers/health/types';
import { PermissionStatus } from '@/src/providers/health/types/permissions';

/**
 * Enhanced mock configuration for health providers
 */
export interface HealthProviderMockConfig {
  isAvailable?: boolean;
  initializationError?: Error;
  permissionStatus?: PermissionStatus;
  healthData?: TestHealthData;
  rawData?: RawHealthData;
  syncTime?: Date;
}

/**
 * Enhanced mock configuration for Supabase client
 */
export interface SupabaseMockConfig {
  auth?: {
    user?: TestUser;
    session?: TestSession;
    signUpError?: Error;
    signInError?: Error;
  };
  data?: {
    [key: string]: any;
  };
  realtimeSubscriptions?: {
    [channel: string]: {
      events: string[];
      data: any;
    };
  };
}

/**
 * Enhanced mock configuration for metrics service
 */
export interface MetricsServiceMockConfig {
  initialMetrics?: TestHealthData;
  calculationErrors?: {
    [metric: string]: Error;
  };
  trendData?: {
    [metric: string]: {
      trend: 'increasing' | 'decreasing' | 'stable';
      consistency: number;
    };
  };
}

/**
 * Enhanced mock configuration for health metrics
 */
export interface HealthMetricsMockConfig {
  defaultGoals?: {
    [metric: string]: number;
  };
  adjustmentFactors?: {
    [metric: string]: number;
  };
  validationRules?: {
    [metric: string]: {
      min: number;
      max: number;
    };
  };
}

/**
 * Mock validation result interface
 */
export interface MockValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Mock factory configuration interface
 */
export interface MockFactoryConfig {
  healthProvider?: HealthProviderMockConfig;
  supabase?: SupabaseMockConfig;
  metricsService?: MetricsServiceMockConfig;
  healthMetrics?: HealthMetricsMockConfig;
}

/**
 * Mock event handler type
 */
export type MockEventHandler = (...args: any[]) => void;

/**
 * Mock subscription interface
 */
export interface MockSubscription {
  unsubscribe: () => void;
  handlers: Map<string, MockEventHandler[]>;
}
