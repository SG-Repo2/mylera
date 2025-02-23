import { unifiedMetricsService } from '../unifiedMetricsService';
import { metricsService } from '../metricsService';
import { supabase } from '../supabaseClient';
import { scoreCalculatorService } from '../scoreCalculatorService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailyMetricScore } from '../../types/schemas';
import type { HealthMetrics } from '../../providers/health/types/metrics';
import type { HealthProvider } from '../../providers/health/types/provider';
import type { PermissionManager, PermissionState } from '../../providers/health/types/permissions';

// Mock dependencies
jest.mock('../metricsService');
jest.mock('../scoreCalculatorService');
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
  mergeItem: jest.fn()
}));
jest.mock('../supabaseClient', () => ({
  supabase: {
    rpc: jest.fn().mockImplementation((method, params) => {
      switch (method) {
        case 'begin_transaction':
        case 'commit_transaction':
        case 'rollback_transaction':
          return Promise.resolve({ error: null });
        case 'update_metrics_transaction':
          return Promise.resolve({ error: null, data: JSON.parse(params.updates) });
        default:
          return Promise.resolve({ error: new Error(`Unknown method: ${method}`) });
      }
    }),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis()
    }))
  }
}));

describe('unifiedMetricsService', () => {
  const mockUserId = 'test-user-id';
  const mockDate = '2025-02-20';
  
  const mockMetrics: DailyMetricScore[] = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: mockUserId,
      date: mockDate,
      metric_type: 'steps',
      value: 1000,
      points: 10,
      goal: 10000,
      goal_reached: false,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }
  ];

  const mockMetricBase: Omit<DailyMetricScore, 'metric_type' | 'value' | 'goal'> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: mockUserId,
    date: mockDate,
    points: 10,
    goal_reached: false,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  const mockHealthMetrics: HealthMetrics = {
    id: `${mockUserId}-${mockDate}`,
    user_id: mockUserId,
    date: mockDate,
    steps: 1000,
    distance: null,
    calories: null,
    heart_rate: null,
    exercise: null,
    basal_calories: null,
    flights_climbed: null,
    daily_score: 10,
    weekly_score: null,
    streak_days: null,
    last_updated: expect.any(String),
    created_at: expect.any(String),
    updated_at: expect.any(String),
  };

  // Mock scoreCalculatorService responses
  const mockScoreResult = {
    points: 10,
    goalReached: false,
    validationErrors: []
  };

  // Create a mock implementation of HealthProvider
  class MockHealthProvider implements HealthProvider {
    private initialized = false;
    private permissionManager: PermissionManager | null = null;

    async initialize(): Promise<void> {
      this.initialized = true;
    }

    resetState(): void {}

    async cleanup(): Promise<void> {
      this.initialized = false;
    }

    async initializePermissions(): Promise<void> {}

    async requestPermissions(): Promise<'granted'> {
      return 'granted';
    }

    async checkPermissionsStatus(): Promise<PermissionState> {
      return { status: 'granted', lastChecked: Date.now() };
    }

    async handlePermissionDenial(): Promise<void> {}

    getPermissionManager(): PermissionManager | null {
      return this.permissionManager;
    }

    isInitialized(): boolean {
      return this.initialized;
    }

    async fetchRawMetrics(): Promise<any> {
      return {};
    }

    normalizeMetrics(): any[] {
      return [];
    }

    getMetrics = jest.fn().mockResolvedValue(mockHealthMetrics);

    async isAvailable(): Promise<boolean> {
      return true;
    }

    async getLastSyncTime(): Promise<Date | null> {
      return null;
    }

    async setLastSyncTime(): Promise<void> {
      // No-op for mock
    }

    getUserId(): string {
      return mockUserId;
    }
  }

  const mockProvider = new MockHealthProvider();

  beforeEach(() => {
    jest.clearAllMocks();
    unifiedMetricsService.resetState();
    
    // Mock metricsService methods
    (metricsService.getDailyMetrics as jest.Mock).mockResolvedValue(mockMetrics);
    (metricsService.updateMetric as jest.Mock).mockResolvedValue(undefined);

    // Mock scoreCalculatorService methods
    (scoreCalculatorService.calculateMetricScore as jest.Mock).mockReturnValue(mockScoreResult);
    (scoreCalculatorService.calculateTotalScore as jest.Mock).mockReturnValue(10);
  });

  describe('source configuration and sync status', () => {
    it('should return correct source information for metrics', () => {
      const stepsSource = unifiedMetricsService.getMetricSource('steps');
      expect(stepsSource).toEqual({
        source: 'native',
        priority: 1,
        staleness: 5,
        lastSynced: null,
        metricTypes: ['steps'],
        dataSourceName: "Device Health API",
        requiresValidation: true
      });

      const basalCaloriesSource = unifiedMetricsService.getMetricSource('basal_calories');
      expect(basalCaloriesSource).toEqual({
        source: 'calculated',
        priority: 3,
        staleness: 60,
        lastSynced: null,
        metricTypes: ['basal_calories', 'heart_rate'],
        dataSourceName: "Calculated from Heart Rate",
        requiresValidation: false
      });
    });

    it('should handle derived metrics calculation', async () => {
      const mockMetricsWithHeartRate: HealthMetrics = {
        ...mockHealthMetrics,
        heart_rate: 75
      };

      const derivedMetrics = unifiedMetricsService['calculateDerivedMetrics'](mockMetricsWithHeartRate);
      expect(derivedMetrics.basal_calories).toBeDefined();
      expect(typeof derivedMetrics.basal_calories).toBe('number');
    });

    it('should handle metric validation during synchronization', async () => {
      const invalidMetrics: HealthMetrics = {
        ...mockHealthMetrics,
        steps: -1000 // Invalid value
      };

      (scoreCalculatorService.calculateMetricScore as jest.Mock).mockReturnValueOnce({
        points: 0,
        goalReached: false,
        validationErrors: ['steps cannot be negative']
      });

      await unifiedMetricsService.synchronizeMetrics(invalidMetrics, mockUserId);

      const updates = JSON.parse((supabase.rpc as jest.Mock).mock.calls
        .find(call => call[0] === 'update_metrics_transaction')?.[1]?.updates || '[]');
      
      expect(updates).not.toContainEqual(expect.objectContaining({
        metric_type: 'steps',
        value: -1000
      }));
    });

    it('should retry failed synchronizations', async () => {
      const mockError = new Error('Sync failed');
      let attempts = 0;

      (supabase.rpc as jest.Mock).mockImplementation(() => {
        attempts++;
        if (attempts <= 2) {
          return Promise.resolve({ error: mockError });
        }
        return Promise.resolve({ error: null });
      });

      await unifiedMetricsService.synchronizeMetrics(mockHealthMetrics, mockUserId);
      expect(attempts).toBeGreaterThan(1);
    });
  });

  describe('metric caching', () => {
    beforeEach(() => {
      // Reset AsyncStorage mock state
      (AsyncStorage.setItem as jest.Mock).mockClear();
      (AsyncStorage.getItem as jest.Mock).mockClear();
    });

    it('should cache metrics after successful synchronization', async () => {
      // Mock successful transaction
      (supabase.rpc as jest.Mock).mockImplementation(() => ({
        error: null,
        data: []
      }));

      await unifiedMetricsService.synchronizeMetrics(mockHealthMetrics, mockUserId);
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining(mockUserId),
        expect.stringMatching(/daily_score/)
      );
    });

    it('should retrieve cached metrics', async () => {
      const cachedData = {
        metrics: mockHealthMetrics,
        timestamp: Date.now()
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await unifiedMetricsService.getCachedMetrics(mockUserId);
      expect(result).toEqual(cachedData);
    });
  });
});
