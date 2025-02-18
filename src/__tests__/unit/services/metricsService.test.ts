import { MetricType } from '@/src/types/metrics';
import {
  metricsService,
  simulateMetricUpdate,
  simulatePartialSuccess,
  simulateHistoricalMetrics,
  simulateDailyTotals,
  setNetworkConditions,
  MetricsValidationError,
  MetricsNetworkError,
  metricValidationRules
} from '@/src/__mocks__/metricsService';

describe('Metrics Service', () => {
  const userId = 'test-user';

  beforeEach(() => {
    jest.clearAllMocks();
    setNetworkConditions({ latency: 200, reliability: 1 }); // Reset to default network conditions
  });

  describe('Metric Updates', () => {
    it('validates metric data before updates', async () => {
      // Valid update
      await expect(simulateMetricUpdate(userId, 'steps', 8000)).resolves.toMatchObject({
        user_id: userId,
        metric_type: 'steps',
        value: 8000
      });

      // Invalid update (negative steps)
      await expect(simulateMetricUpdate(userId, 'steps', -100)).rejects.toThrow(MetricsValidationError);

      // Invalid update (heart rate too high)
      await expect(simulateMetricUpdate(userId, 'heart_rate', 250)).rejects.toThrow(MetricsValidationError);
    });

    it('handles network conditions during updates', async () => {
      // Simulate poor network conditions
      setNetworkConditions({ 
        latency: 1000, 
        reliability: 0.5,
        errorRate: 0.2 
      }); // 1 second latency, 50% reliability, 20% error rate

      const updatePromises = Array(5).fill(null).map(() =>
        simulateMetricUpdate(userId, 'steps', 8000)
          .then(() => 'success')
          .catch(error => {
            expect(error).toBeInstanceOf(MetricsNetworkError);
            return 'failure';
          })
      );

      const results = await Promise.all(updatePromises);
      const failures = results.filter(result => result === 'failure');
      
      // With 50% reliability, expect some failures
      expect(failures.length).toBeGreaterThan(0);
    });

    it('handles partial success scenarios', async () => {
      const metrics: Array<{ type: MetricType; value: number }> = [
        { type: 'steps' as MetricType, value: 8000 },
        { type: 'heart_rate' as MetricType, value: 75 },
        { type: 'calories' as MetricType, value: 400 }
      ];

      const results =  simulatePartialSuccess(userId, metrics, 0.7);
      
      expect(results).toHaveLength(3);
      const successfulUpdates = results.filter(r => r.success);
      expect(successfulUpdates.length).toBeGreaterThan(0);
      expect(successfulUpdates.length).toBeLessThan(4);
    });
  });

  describe('Historical Data', () => {
    it('simulates historical metrics with trends', async () => {
      const days = 30;
      const baseValue = 8000;

      // Simulate increasing trend
      const increasingData = await simulateHistoricalMetrics(userId, 'steps', days, baseValue, {
        trend: 'increasing',
        trendStrength: 0.2
      });

      expect(increasingData).toHaveLength(days);
      const firstWeekAvg = increasingData.slice(-7).reduce((sum, day) => sum + day.value, 0) / 7;
      const lastWeekAvg = increasingData.slice(0, 7).reduce((sum, day) => sum + day.value, 0) / 7;
      expect(lastWeekAvg).toBeGreaterThan(firstWeekAvg);

      // Simulate decreasing trend
      const decreasingData = await simulateHistoricalMetrics(userId, 'steps', days, baseValue, {
        trend: 'decreasing',
        trendStrength: 0.2
      });

      expect(decreasingData).toHaveLength(days);
      const decFirstWeekAvg = decreasingData.slice(-7).reduce((sum, day) => sum + day.value, 0) / 7;
      const decLastWeekAvg = decreasingData.slice(0, 7).reduce((sum, day) => sum + day.value, 0) / 7;
      expect(decLastWeekAvg).toBeLessThan(decFirstWeekAvg);
    });
  });

  describe('Daily Totals', () => {
    it('simulates daily totals with achievements', async () => {
      const achievements = ['daily-goal-streak', 'steps-milestone'];
      const totals = await simulateDailyTotals(userId, 150, 7, achievements);

      expect(totals).toMatchObject({
        user_id: userId,
        total_points: 150,
        metrics_completed: 7,
        achievements: expect.arrayContaining(achievements)
      });
    });
  });

  describe('Validation Rules', () => {
    it('enforces metric-specific validation rules', () => {
      // Steps validation
      expect(metricValidationRules.steps.validate(8000)).toBe(true);
      expect(metricValidationRules.steps.validate(-100)).toBe(false);
      expect(metricValidationRules.steps.validate(150000)).toBe(false);

      // Heart rate validation
      expect(metricValidationRules.heart_rate.validate(75)).toBe(true);
      expect(metricValidationRules.heart_rate.validate(25)).toBe(false);
      expect(metricValidationRules.heart_rate.validate(250)).toBe(false);

      // Exercise minutes validation
      expect(metricValidationRules.exercise.validate(30)).toBe(true);
      expect(metricValidationRules.exercise.validate(-10)).toBe(false);
      expect(metricValidationRules.exercise.validate(1500)).toBe(false);
    });

    it('provides validation error messages', () => {
      expect(metricValidationRules.steps.message).toBe('Steps must be between 0 and 100,000');
      expect(metricValidationRules.heart_rate.message).toBe('Heart rate must be between 30 and 220 bpm');
      expect(metricValidationRules.exercise.message).toBe('Exercise minutes must be between 0 and 1,440 (24 hours)');
    });
  });

  describe('Network Conditions', () => {
    it('handles network timeouts', async () => {
      setNetworkConditions({
        latency: 100,
        reliability: 1,
        timeoutRate: 1,
        timeoutDuration: 1000
      });

      await expect(simulateMetricUpdate(userId, 'steps', 8000))
        .rejects
        .toThrow('Request timed out');
    });

    it('handles different types of network failures', async () => {
      // Test connection loss
      setNetworkConditions({ reliability: 0 });
      await expect(simulateMetricUpdate(userId, 'steps', 8000))
        .rejects
        .toThrow('Connection lost');

      // Test network error
      setNetworkConditions({ errorRate: 1 });
      await expect(simulateMetricUpdate(userId, 'steps', 8000))
        .rejects
        .toThrow('Network request failed');
    });

    it('handles rate limiting with exponential backoff', async () => {
      let attempts = 0;
      const maxAttempts = 3;
      
      setNetworkConditions({
        reliability: 1,
        errorRate: 0,
        latency: 50,
        timeoutRate: 0
      });

      // Mock rate limit error for first attempts
      metricsService.updateMetric.mockImplementation(() => {
        attempts++;
        if (attempts < maxAttempts) {
          throw new MetricsNetworkError('Rate limit exceeded');
        }
        return Promise.resolve({ success: true });
      });

      const startTime = Date.now();
      await simulateMetricUpdate(userId, 'steps', 8000);
      const duration = Date.now() - startTime;

      expect(attempts).toBe(maxAttempts);
      // Verify exponential backoff timing
      expect(duration).toBeGreaterThan(50 * (Math.pow(2, maxAttempts) - 1));
    });

    it('handles intermittent failures with retry', async () => {
      setNetworkConditions({
        reliability: 0.5, // 50% chance of failure
        latency: 100
      });

      const results = await Promise.allSettled(
        Array(10).fill(null).map(() => 
          simulateMetricUpdate(userId, 'steps', 8000)
        )
      );

      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(succeeded.length).toBeGreaterThan(0);
      expect(failed.length).toBeGreaterThan(0);
      expect(succeeded.length + failed.length).toBe(10);
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(() => {
      setNetworkConditions({ 
        latency: 100,
        reliability: 1
      });
    });

    it('handles concurrent metric updates', async () => {
      const metrics = [
        { type: 'steps' as MetricType, value: 8000 },
        { type: 'heart_rate' as MetricType, value: 75 },
        { type: 'exercise' as MetricType, value: 30 }
      ];

      const results = await Promise.all(
        metrics.map(m => simulateMetricUpdate(userId, m.type, m.value))
      );

      expect(results).toHaveLength(metrics.length);
      results.forEach((result, index) => {
        expect(result).toMatchObject({
          metric_type: metrics[index].type,
          value: metrics[index].value
        });
      });
    });

    it('maintains data consistency during concurrent updates', async () => {
      const updates = Array(5).fill(null).map((_, i) => ({
        type: 'steps' as MetricType,
        value: 1000 * (i + 1)
      }));

      const results = await Promise.all(
        updates.map(u => simulateMetricUpdate(userId, u.type, u.value))
      );

      // Verify each update has unique timestamp
      const timestamps = results.map(r => r.updated_at);
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(updates.length);

      // Verify values are correctly recorded
      results.forEach((result, index) => {
        expect(result.value).toBe(updates[index].value);
      });
    });
  });
});
