import { metricsService } from '@/src/services/metricsService';
import { supabase } from '@/src/services/supabaseClient';
import { mockHealthData } from '../utils/testHelpers';

jest.mock('@/src/services/supabaseClient');

describe('metricsService', () => {
  const mockUserId = 'test-user-123';
  const mockDate = '2024-02-18';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase auth session
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          user: { id: mockUserId },
        },
      },
    });

    // Mock Supabase database operations
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    });
  });

  describe('getDailyMetrics', () => {
    it('fetches daily metrics successfully', async () => {
      const mockMetrics = [
        {
          id: 'metric-1',
          user_id: mockUserId,
          metric_type: 'steps',
          value: 10000,
          points: 50,
        },
      ];

      (supabase.from as jest.Mock)().select.mockResolvedValue({
        data: mockMetrics,
        error: null,
      });

      const result = await metricsService.getDailyMetrics(mockUserId, mockDate);
      expect(result).toEqual(mockMetrics);
    });

    it('handles fetch errors', async () => {
      (supabase.from as jest.Mock)().select.mockResolvedValue({
        data: null,
        error: new Error('Failed to fetch metrics'),
      });

      await expect(metricsService.getDailyMetrics(mockUserId, mockDate)).rejects.toThrow();
    });
  });

  describe('getHistoricalMetrics', () => {
    it('fetches historical metrics successfully', async () => {
      const mockHistoricalData = [
        { date: '2024-02-17', value: 8000 },
        { date: '2024-02-18', value: 10000 },
      ];

      (supabase.from as jest.Mock)().select.mockResolvedValue({
        data: mockHistoricalData,
        error: null,
      });

      const result = await metricsService.getHistoricalMetrics(mockUserId, 'steps', mockDate);
      expect(result).toEqual(mockHistoricalData);
    });

    it('handles date range correctly', async () => {
      await metricsService.getHistoricalMetrics(mockUserId, 'steps', mockDate);

      expect(supabase.from).toHaveBeenCalledWith('daily_metric_scores');
      expect(supabase.from().gte).toHaveBeenCalled();
      expect(supabase.from().lte).toHaveBeenCalled();
    });
  });

  describe('getDailyTotals', () => {
    it('fetches daily totals successfully', async () => {
      const mockTotals = [
        {
          id: 'total-1',
          user_id: mockUserId,
          total_points: 100,
          metrics_completed: 5,
        },
      ];

      (supabase.from as jest.Mock)().select.mockResolvedValue({
        data: mockTotals,
        error: null,
      });

      const result = await metricsService.getDailyTotals(mockDate);
      expect(result).toEqual(mockTotals);
    });
  });

  describe('updateMetric', () => {
    it('updates metric successfully', async () => {
      const mockMetricData = {
        user_id: mockUserId,
        metric_type: 'steps',
        value: 10000,
      };

      (supabase.from as jest.Mock)().upsert.mockResolvedValue({
        data: [mockMetricData],
        error: null,
      });

      await metricsService.updateMetric(mockUserId, 'steps', 10000);

      expect(supabase.from).toHaveBeenCalledWith('daily_metric_scores');
      expect(supabase.from().upsert).toHaveBeenCalled();
    });

    it('calculates points correctly', async () => {
      await metricsService.updateMetric(mockUserId, 'steps', 10000);

      const upsertCall = (supabase.from as jest.Mock)().upsert.mock.calls[0][0];
      expect(upsertCall).toHaveProperty('points');
      expect(upsertCall.points).toBeGreaterThan(0);
    });

    it('handles unauthorized updates', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      await expect(metricsService.updateMetric(mockUserId, 'steps', 10000)).rejects.toThrow(
        'User must be authenticated'
      );
    });

    it('handles permission errors', async () => {
      (supabase.from as jest.Mock)().upsert.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(metricsService.updateMetric(mockUserId, 'steps', 10000)).rejects.toThrow(
        'Permission denied'
      );
    });

    it('updates daily totals after metric update', async () => {
      // Mock successful metric update
      (supabase.from as jest.Mock)().upsert.mockResolvedValue({
        data: [{ points: 50 }],
        error: null,
      });

      // Mock fetching current metrics
      (supabase.from as jest.Mock)().select.mockResolvedValue({
        data: [
          { metric_type: 'steps', points: 50, goal_reached: true },
          { metric_type: 'distance', points: 30, goal_reached: true },
        ],
        error: null,
      });

      await metricsService.updateMetric(mockUserId, 'steps', 10000);

      // Verify daily totals update
      expect(supabase.from).toHaveBeenCalledWith('daily_totals');
      const totalsCalls = (supabase.from as jest.Mock)().upsert.mock.calls;
      const lastTotalsCall = totalsCalls[totalsCalls.length - 1][0];
      expect(lastTotalsCall).toHaveProperty('total_points', 80);
      expect(lastTotalsCall).toHaveProperty('metrics_completed', 2);
    });

    it('handles development environment scoring', async () => {
      const originalDev = global.__DEV__;
      global.__DEV__ = true;

      await metricsService.updateMetric(mockUserId, 'steps', 100);

      const upsertCall = (supabase.from as jest.Mock)().upsert.mock.calls[0][0];
      expect(upsertCall.points).toBe(50); // Development scoring should be simplified

      global.__DEV__ = originalDev;
    });
  });
}); 