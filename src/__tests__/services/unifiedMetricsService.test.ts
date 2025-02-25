import { unifiedMetricsService } from '@/src/services/unifiedMetricsService';
import { metricsService } from '@/src/services/metricsService';
import { supabase } from '@/src/services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DateUtils } from '@/src/utils/DateUtils';
import { scoreCalculatorService } from '@/src/services/scoreCalculatorService';
import type { MetricType, DailyMetricScore } from '@/src/types/schemas';
import { act } from '@testing-library/react-native';

// Mock dependencies
jest.mock('@/src/services/metricsService');
jest.mock('@/src/services/scoreCalculatorService');
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('@/src/services/supabaseClient', () => ({
  supabase: {
    rpc: jest.fn().mockResolvedValue({ error: null }),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

jest.mock('@/src/services/metricsService', () => ({
  metricsService: {
    getDailyMetrics: jest.fn(),
  },
}));

jest.mock('@/src/services/scoreCalculatorService', () => ({
  scoreCalculatorService: {
    calculateMetricScore: jest.fn().mockReturnValue({ validationErrors: [] }),
    calculateTotalScore: jest.fn().mockReturnValue(100),
    verifyTotalScore: jest.fn().mockReturnValue(true),
  },
}));

const createMetricScore = (
  userId: string,
  date: string,
  metricType: MetricType,
  value: number,
  goalReached: boolean,
  points: number,
  goal: number
): DailyMetricScore => ({
  id: `${userId}-${date}-${metricType}`,
  user_id: userId,
  date,
  metric_type: metricType,
  value,
  goal_reached: goalReached,
  points,
  goal,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

describe('unifiedMetricsService', () => {
  const mockUserId = 'test-user-123';
  const mockDate = '2025-02-24';
  
  beforeEach(() => {
    jest.clearAllMocks();
    unifiedMetricsService.resetState();
  });

  describe('caching operations', () => {
    it('caches metrics successfully', async () => {
      const testMetrics = {
        steps: 1000,
        calories: 500,
        distance: 750,
        heart_rate: 70,
        exercise: 30,
        basal_calories: 500,
        flights_climbed: 10,
        daily_score: 0,
        weekly_score: null,
        streak_days: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        user_id: mockUserId,
        date: DateUtils.getLocalDateString(),
        id: `${mockUserId}-${DateUtils.getLocalDateString()}`,
      };
      
      await unifiedMetricsService.cacheMetrics(mockUserId, testMetrics);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        `@MyLera:metrics:${mockUserId}`,
        expect.any(String)
      );
    });

    it('retrieves cached metrics successfully', async () => {
      const mockCachedData = {
        metrics: {
          steps: 1000,
          calories: 500,
          user_id: mockUserId,
          date: mockDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        },
        timestamp: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockCachedData)
      );

      const result = await unifiedMetricsService.getCachedMetrics(mockUserId);
      expect(result).toBeTruthy();
      expect(result?.metrics.steps).toBe(1000);
    });

    it('handles cache retrieval errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
      const result = await unifiedMetricsService.getCachedMetrics(mockUserId);
      expect(result).toBeNull();
    });
  });

  describe('metrics operations', () => {
    const mockCompleteMetrics: DailyMetricScore[] = [
      createMetricScore(mockUserId, mockDate, 'steps', 1000, false, 10, 10000),
      createMetricScore(mockUserId, mockDate, 'distance', 800, false, 8, 8000),
      createMetricScore(mockUserId, mockDate, 'calories', 400, false, 4, 2000),
      createMetricScore(mockUserId, mockDate, 'heart_rate', 70, true, 10, 60),
      createMetricScore(mockUserId, mockDate, 'basal_calories', 500, false, 5, 1000),
      createMetricScore(mockUserId, mockDate, 'flights_climbed', 10, true, 10, 10),
      createMetricScore(mockUserId, mockDate, 'exercise', 30, true, 10, 30)
    ];

    it('correctly identifies complete metrics', () => {
      expect(unifiedMetricsService.hasCompleteMetrics(mockCompleteMetrics)).toBe(true);
    });

    it('identifies incomplete metrics', () => {
      const incompleteMetrics = mockCompleteMetrics.slice(0, -1);
      expect(unifiedMetricsService.hasCompleteMetrics(incompleteMetrics)).toBe(false);
    });

    it('transforms database metrics to health metrics correctly', () => {
      const transformed = unifiedMetricsService.transformDatabaseMetricsToHealthMetrics(
        mockCompleteMetrics,
        mockUserId,
        mockDate
      );

      expect(transformed.steps).toBe(1000);
      expect(transformed.distance).toBe(800);
      expect(transformed.calories).toBe(400);
      expect(transformed.user_id).toBe(mockUserId);
      expect(transformed.date).toBe(mockDate);
    });

    it('calculates derived metrics correctly', () => {
      const baseMetrics = {
        steps: 1000,
        heart_rate: 70,
        calories: null,
        distance: null,
        exercise: null,
        basal_calories: null,
        flights_climbed: null,
        daily_score: 0,
        weekly_score: null,
        streak_days: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        user_id: mockUserId,
        date: mockDate,
        id: `${mockUserId}-${mockDate}`,
      };

      const derived = unifiedMetricsService.calculateDerivedMetrics(baseMetrics);
      expect(derived.basal_calories).toBe(Math.round(70 * 7.5));
      expect(derived.calories).toBe(Math.round(1000 * 0.04));
      expect(derived.distance).toBe(Math.round(1000 * 0.762));
    });
  });

  describe('synchronization', () => {
    const mockNativeMetrics = {
      steps: 1500,
      distance: 1200,
      calories: 600,
      heart_rate: 75,
      exercise: 40,
      basal_calories: 550,
      flights_climbed: 12,
      daily_score: 0,
      weekly_score: null,
      streak_days: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      user_id: mockUserId,
      date: mockDate,
      id: `${mockUserId}-${mockDate}`,
    };

    it('synchronizes metrics with retry on failure', async () => {
      const mockError = new Error('Sync failed');
      let attempts = 0;
      
      // Mock the setTimeout to execute immediately
      jest.useFakeTimers();
      
      (supabase.rpc as jest.Mock).mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          return Promise.resolve({ error: mockError });
        }
        return Promise.resolve({ error: null });
      });

      const syncPromise = unifiedMetricsService.synchronizeMetrics(mockNativeMetrics, mockUserId);
      
      // Fast-forward through initialization and retry delays
      await act(async () => {
        // Let initialization complete
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        await Promise.resolve();
        
        // Let first attempt fail and trigger retry
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        
        // Let retry succeed
        jest.advanceTimersByTime(100);
        await Promise.resolve();
        
        // Run any remaining timers
        jest.runAllTimers();
      });
      
      await syncPromise;
      
      expect(attempts).toBe(2);
      
      jest.useRealTimers();
    }, 50000); // Increase timeout for verification test

    it('verifies metric updates correctly', async () => {
      // Mock Supabase response with retry behavior
      let attempts = 0;
      const mockData = [
        { 
          id: '1', 
          user_id: mockUserId, 
          date: mockDate, 
          metric_type: 'steps', 
          value: 1500,
          verified: true 
        },
        { 
          id: '2', 
          user_id: mockUserId, 
          date: mockDate, 
          metric_type: 'heart_rate', 
          value: 75,
          verified: true 
        },
        { 
          id: '3', 
          user_id: mockUserId, 
          date: mockDate, 
          metric_type: 'flights_climbed', 
          value: 12,
          verified: true 
        }
      ];

      // Mock the Supabase query chain
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(() => {
          attempts++;
          if (attempts === 1) {
            return Promise.resolve({ data: [], error: new Error('Database timeout') });
          }
          return Promise.resolve({ data: mockData, error: null });
        })
      });

      // Start verification process
      const verificationResult = await new Promise((resolve) => {
        const promise = unifiedMetricsService.verifyMetricUpdates(
          mockNativeMetrics,
          mockUserId
        );

        // Use setImmediate to handle async operations
        setImmediate(async () => {
          jest.runAllTimers();
          const result = await promise;
          resolve(result);
        });
      });

      // Verify each metric was checked correctly
      expect(verificationResult).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            metricType: 'steps',
            expected: 1500,
            actual: 1500,
            matched: true,
            timestamp: expect.any(String)
          }),
          expect.objectContaining({
            metricType: 'heart_rate',
            expected: 75,
            actual: 75,
            matched: true,
            timestamp: expect.any(String)
          }),
          expect.objectContaining({
            metricType: 'flights_climbed',
            expected: 12,
            actual: 12,
            matched: true,
            timestamp: expect.any(String)
          })
        ])
      );

      // Verify retry behavior
      expect(attempts).toBe(2);

      // Verify Supabase query chain
      expect(supabase.from).toHaveBeenCalledWith('daily_metric_scores');
      const mockChain = (supabase.from as jest.Mock).mock.results[0].value;
      expect(mockChain.select).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockChain.eq).toHaveBeenCalledWith('date', mockNativeMetrics.date);
    }, 60000); // Match Jest config timeout
  });

  describe('staleness checks', () => {
    it('correctly identifies stale metrics', () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 1);
      
      expect(unifiedMetricsService.isMetricStale('steps', oldDate.toISOString())).toBe(true);
    });

    it('correctly identifies fresh metrics', () => {
      const freshDate = new Date();
      expect(unifiedMetricsService.isMetricStale('steps', freshDate.toISOString())).toBe(false);
    });
  });
});
