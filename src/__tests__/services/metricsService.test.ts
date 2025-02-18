import { metricsService } from '@/src/services/metricsService';
import { supabase } from '@/src/services/supabaseClient';
import { MockFactory } from '../utils/mockFactory';

jest.mock('@/src/services/supabaseClient');

describe('metricsService', () => {
  const mockUser = MockFactory.createTestUser();
  const mockDate = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase auth session
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          user: mockUser,
        },
      },
    });

    // Mock Supabase database operations with proper method chaining
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
          user_id: mockUser.id,
          metric_type: 'steps',
          value: 10000,
          points: 50,
        },
      ];

      (supabase.from as jest.Mock)().select.mockResolvedValue({
        data: mockMetrics,
        error: null,
      });

      const result = await metricsService.getDailyMetrics(mockUser.id, mockDate);
      expect(result).toEqual(mockMetrics);
    });

    it('handles fetch errors', async () => {
      (supabase.from as jest.Mock)().select.mockResolvedValue({
        data: null,
        error: new Error('Failed to fetch metrics'),
      });

      await expect(metricsService.getDailyMetrics(mockUser.id, mockDate)).rejects.toThrow();
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

      const result = await metricsService.getHistoricalMetrics(mockUser.id, 'steps', mockDate);
      expect(result).toEqual(mockHistoricalData);
    });

    it('handles date range correctly', async () => {
      const startDate = new Date(mockDate);
      startDate.setDate(startDate.getDate() - 7); // 7 days before
      const startDateStr = startDate.toISOString().split('T')[0];

      await metricsService.getHistoricalMetrics(mockUser.id, 'steps', mockDate);

      expect(supabase.from).toHaveBeenCalledWith('daily_metric_scores');
      expect(supabase.from().gte).toHaveBeenCalledWith('date', startDateStr);
      expect(supabase.from().lte).toHaveBeenCalledWith('date', mockDate);
    });
  });

  describe('getDailyTotals', () => {
    it('fetches daily totals successfully', async () => {
      const mockTotals = [
        {
          id: 'total-1',
          user_id: mockUser.id,
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
        user_id: mockUser.id,
        metric_type: 'steps',
        value: 10000,
        points: 50,
        goal_reached: true,
        date: mockDate
      };

      (supabase.from as jest.Mock)().upsert.mockResolvedValue({
        data: [mockMetricData],
        error: null,
      });

      const result = await metricsService.updateMetric(mockUser.id, 'steps', 10000);

      expect(result).toEqual(mockMetricData);
      expect(supabase.from).toHaveBeenCalledWith('daily_metric_scores');
      const dailyMetricScores = (supabase.from as jest.Mock).mock.results[0].value;
      expect(dailyMetricScores.upsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: mockUser.id,
        metric_type: 'steps',
        value: 10000
      }));
    });

    it('validates metric values before update', async () => {
      // Test invalid steps (negative value)
      await expect(metricsService.updateMetric(mockUser.id, 'steps', -100))
        .rejects.toThrow('Invalid value for steps');

      // Test invalid heart rate (too high)
      await expect(metricsService.updateMetric(mockUser.id, 'heart_rate', 250))
        .rejects.toThrow('Invalid value for heart rate');
    });

    it('calculates points correctly for different metrics', async () => {
      // Test steps points calculation
      await metricsService.updateMetric(mockUser.id, 'steps', 10000);
      let upsertCall = (supabase.from as jest.Mock)().upsert.mock.calls[0][0];
      expect(upsertCall.points).toBeGreaterThan(0);
      expect(upsertCall.goal_reached).toBe(true);

      // Test heart rate points calculation
      await metricsService.updateMetric(mockUser.id, 'heart_rate', 75);
      upsertCall = (supabase.from as jest.Mock)().upsert.mock.calls[1][0];
      expect(upsertCall.points).toBeGreaterThan(0);
      expect(upsertCall.goal_reached).toBe(true);

      // Test exercise minutes points calculation
      await metricsService.updateMetric(mockUser.id, 'exercise', 30);
      upsertCall = (supabase.from as jest.Mock)().upsert.mock.calls[2][0];
      expect(upsertCall.points).toBeGreaterThan(0);
      expect(upsertCall.goal_reached).toBe(true);
    });

    it('handles unauthorized updates', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      await expect(metricsService.updateMetric(mockUser.id, 'steps', 10000)).rejects.toThrow(
        'User must be authenticated'
      );
    });

    it('handles permission errors', async () => {
      (supabase.from as jest.Mock)().upsert.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(metricsService.updateMetric(mockUser.id, 'steps', 10000)).rejects.toThrow(
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

      await metricsService.updateMetric(mockUser.id, 'steps', 10000);

      // Verify daily totals update
      expect(supabase.from).toHaveBeenCalledWith('daily_totals');
      const totalsCalls = (supabase.from as jest.Mock)().upsert.mock.calls;
      const lastTotalsCall = totalsCalls[totalsCalls.length - 1][0];
      expect(lastTotalsCall).toHaveProperty('total_points', 80);
      expect(lastTotalsCall).toHaveProperty('metrics_completed', 2);
    });

    describe('development environment handling', () => {
      let originalDev: boolean;

      beforeEach(() => {
        originalDev = (global as any).__DEV__;
      });

      afterEach(() => {
        (global as any).__DEV__ = originalDev;
      });

      it('uses simplified scoring in development', async () => {
        (global as any).__DEV__ = true;

        await metricsService.updateMetric(mockUser.id, 'steps', 100);
        const upsertCall = (supabase.from as jest.Mock)().upsert.mock.calls[0][0];
        expect(upsertCall.points).toBe(50);
      });

      it('uses normal scoring in production', async () => {
        (global as any).__DEV__ = false;

        await metricsService.updateMetric(mockUser.id, 'steps', 10000);
        const upsertCall = (supabase.from as jest.Mock)().upsert.mock.calls[0][0];
        expect(upsertCall.points).toBeGreaterThan(0);
        expect(upsertCall.points).not.toBe(50);
      });
    });
  });
});
