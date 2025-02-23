import { unifiedMetricsService } from '../unifiedMetricsService';
import { metricsService } from '../metricsService';
import { supabase } from '../supabaseClient';
import type { DailyMetricScore } from '../../types/schemas';
import type { HealthMetrics } from '../../providers/health/types/metrics';
import type { HealthProvider } from '../../providers/health/types/provider';
import type { PermissionManager, PermissionState } from '../../providers/health/types/permissions';

// Mock dependencies
jest.mock('../metricsService');
jest.mock('../supabaseClient', () => ({
  supabase: {
    rpc: jest.fn().mockImplementation((method) => {
      switch (method) {
        case 'begin_transaction':
        case 'commit_transaction':
        case 'rollback_transaction':
          return Promise.resolve({ error: null });
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
    })),
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-id'
            }
          }
        }
      })
    }
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

    async setLastSyncTime(): Promise<void> {}
  }

  const mockProvider = new MockHealthProvider();

  beforeEach(() => {
    jest.clearAllMocks();
    

    // Mock metricsService methods
    (metricsService.getDailyMetrics as jest.Mock).mockResolvedValue(mockMetrics);
    (metricsService.updateMetric as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getMetrics', () => {
    it('should return database metrics if complete and not stale', async () => {
      // Mock complete metrics that are not stale
      const completeMetrics: DailyMetricScore[] = [
        { ...mockMetricBase, metric_type: 'steps', value: 1000, goal: 10000 },
        { ...mockMetricBase, metric_type: 'distance', value: 1.5, goal: 5 },
        { ...mockMetricBase, metric_type: 'calories', value: 500, goal: 2000 },
        { ...mockMetricBase, metric_type: 'heart_rate', value: 75, goal: 150 },
        { ...mockMetricBase, metric_type: 'basal_calories', value: 1200, goal: 2000 },
        { ...mockMetricBase, metric_type: 'flights_climbed', value: 10, goal: 20 },
        { ...mockMetricBase, metric_type: 'exercise', value: 30, goal: 60 }
      ];
      
      (metricsService.getDailyMetrics as jest.Mock).mockResolvedValue(completeMetrics);

      const result = await unifiedMetricsService.getMetrics(mockUserId, mockDate);

      expect(mockProvider.getMetrics).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        steps: 1000,
        distance: 1.5,
        calories: 500,
        heart_rate: 75,
        basal_calories: 1200,
        flights_climbed: 10,
        exercise: 30
      });
    });

    it('should fetch from provider if metrics are stale', async () => {
      // Mock stale metrics (updated more than 5 minutes ago)
      const staleDate = new Date();
      staleDate.setMinutes(staleDate.getMinutes() - 6);
      const staleMetrics = mockMetrics.map(metric => ({
        ...metric,
        updated_at: staleDate.toISOString()
      }));

      const mockNativeMetrics = {
        ...mockHealthMetrics,
        steps: 2000 // Different value to verify we're using native data
      };

      (metricsService.getDailyMetrics as jest.Mock).mockResolvedValue(staleMetrics);
      mockProvider.getMetrics.mockResolvedValue(mockNativeMetrics);

      const result = await unifiedMetricsService.getMetrics(mockUserId, mockDate, mockProvider);

      expect(mockProvider.getMetrics).toHaveBeenCalled();
      expect(result.steps).toBe(2000);
    });

    it('should handle transaction rollback on error', async () => {
      const error = new Error('Provider error');
      mockProvider.getMetrics.mockRejectedValue(error);

      (metricsService.getDailyMetrics as jest.Mock).mockResolvedValue([]);

      await expect(
        unifiedMetricsService.getMetrics(mockUserId, mockDate, mockProvider)
      ).rejects.toThrow('Provider error');

      expect(supabase.rpc).toHaveBeenCalledWith('rollback_transaction');
    });
  });

  describe('shouldFetchNative', () => {
    it('should return true for empty metrics', () => {
      const result = unifiedMetricsService.shouldFetchNative([]);
      expect(result).toBe(true);
    });

    it('should return true for stale metrics', () => {
      const staleDate = new Date();
      staleDate.setMinutes(staleDate.getMinutes() - 6);
      const staleMetrics = [{
        ...mockMetrics[0],
        updated_at: staleDate.toISOString()
      }];

      const result = unifiedMetricsService.shouldFetchNative(staleMetrics);
      expect(result).toBe(true);
    });

    it('should return false for fresh metrics', () => {
      const freshDate = new Date();
      const freshMetrics = [{
        ...mockMetrics[0],
        updated_at: freshDate.toISOString()
      }];

      const result = unifiedMetricsService.shouldFetchNative(freshMetrics);
      expect(result).toBe(false);
    });
  });

  describe('updateMetricsFromNative', () => {
    it('should update all valid metrics and track sync status', async () => {
      const nativeMetrics: HealthMetrics = {
        ...mockHealthMetrics,
        steps: 2000,
        distance: 1.5,
        calories: 500
      };

      await unifiedMetricsService.updateMetricsFromNative(nativeMetrics, mockUserId);

      expect(metricsService.updateMetric).toHaveBeenCalledTimes(3);
      expect(metricsService.updateMetric).toHaveBeenCalledWith(mockUserId, 'steps', 2000);
      expect(metricsService.updateMetric).toHaveBeenCalledWith(mockUserId, 'distance', 1.5);
      expect(metricsService.updateMetric).toHaveBeenCalledWith(mockUserId, 'calories', 500);

      // Verify sync status was updated
      const syncStatus = unifiedMetricsService.getSyncStatus();
      expect(syncStatus.steps.lastSynced).not.toBeNull();
      expect(syncStatus.distance.lastSynced).not.toBeNull();
      expect(syncStatus.calories.lastSynced).not.toBeNull();
    });

    it('should skip invalid metrics and not update their sync status', async () => {
      const nativeMetrics: HealthMetrics = {
        ...mockHealthMetrics,
        steps: NaN,
        distance: 1.5
      };

      await unifiedMetricsService.updateMetricsFromNative(nativeMetrics, mockUserId);

      expect(metricsService.updateMetric).toHaveBeenCalledTimes(1);
      expect(metricsService.updateMetric).toHaveBeenCalledWith(mockUserId, 'distance', 1.5);

      const syncStatus = unifiedMetricsService.getSyncStatus();
      expect(syncStatus.steps.lastSynced).toBeNull();
      expect(syncStatus.distance.lastSynced).not.toBeNull();
    });

    it('should handle update errors and not update sync status on failure', async () => {
      const error = new Error('Update failed');
      (metricsService.updateMetric as jest.Mock).mockRejectedValue(error);

      const nativeMetrics: HealthMetrics = {
        ...mockHealthMetrics,
        steps: 2000
      };

      const initialSyncStatus = unifiedMetricsService.getSyncStatus();

      await expect(
        unifiedMetricsService.updateMetricsFromNative(nativeMetrics, mockUserId)
      ).rejects.toThrow('Update failed');

      const finalSyncStatus = unifiedMetricsService.getSyncStatus();
      expect(finalSyncStatus).toEqual(initialSyncStatus);
    });
  });

  describe('source configuration and sync status', () => {
    it('should correctly identify stale metrics based on configuration', () => {
      const now = new Date();
      const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);
      const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);

      expect(unifiedMetricsService.isMetricStale('steps', sixMinutesAgo.toISOString())).toBe(true);
      expect(unifiedMetricsService.isMetricStale('steps', fourMinutesAgo.toISOString())).toBe(false);
    });

    it('should return correct source information for metrics', () => {
      const stepsSource = unifiedMetricsService.getMetricSource('steps');
      expect(stepsSource).toEqual({
        source: 'native',
        priority: 2,
        staleness: 5,
        lastSynced: null,
        metricTypes: ['steps'],
        dataSourceName: "Device Health API"
      });
    });

    it('should track sync status updates correctly', () => {
      const initialStatus = unifiedMetricsService.getSyncStatus();
      expect(initialStatus.steps.lastSynced).toBeNull();

      unifiedMetricsService.updateSyncStatus('steps');
      
      const updatedStatus = unifiedMetricsService.getSyncStatus();
      expect(updatedStatus.steps.lastSynced).not.toBeNull();
      expect(updatedStatus.steps.isStale).toBe(false);
    });

    it('should provide comprehensive sync status for all metrics', () => {
      const status = unifiedMetricsService.getSyncStatus();
      
      // Check all metric types are included
      expect(Object.keys(status)).toEqual([
        'steps',
        'distance',
        'calories',
        'heart_rate',
        'basal_calories',
        'flights_climbed',
        'exercise'
      ]);

      // Check structure of each status entry
      Object.values(status).forEach(metricStatus => {
        expect(metricStatus).toHaveProperty('lastSynced');
        expect(metricStatus).toHaveProperty('isStale');
      });
    });
  });
});
