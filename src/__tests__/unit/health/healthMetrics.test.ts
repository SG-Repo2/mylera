import { healthMetrics, simulateGoalAdjustment, simulateTrendAnalysis, trendAnalyzers } from '@/src/__mocks__/healthMetrics';
import type { TestHealthData } from '@/src/__tests__/types/test.types';

describe('Health Metrics', () => {
  const mockHistoricalData: TestHealthData[] = [
    { user_id: 'test-user', date: '2025-02-17', steps: 8000 },
    { user_id: 'test-user', date: '2025-02-16', steps: 9000 },
    { user_id: 'test-user', date: '2025-02-15', steps: 10000 }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Goal Adjustments', () => {
    it('suggests increased goals based on historical performance', () => {
      const metric = healthMetrics.steps;
      const suggestedGoal = metric.suggestGoalAdjustment(mockHistoricalData);
      
      expect(suggestedGoal).toBeGreaterThan(metric.defaultGoal);
      expect(typeof suggestedGoal).toBe('number');
    });

    it('allows simulation of goal adjustment suggestions', () => {
      const expectedGoal = 12000;
      simulateGoalAdjustment('steps', expectedGoal);

      const metric = healthMetrics.steps;
      const suggestedGoal = metric.suggestGoalAdjustment(mockHistoricalData);
      
      expect(suggestedGoal).toBe(expectedGoal);
    });
  });

  describe('Trend Analysis', () => {
    it('calculates trends from historical data', () => {
      const trend = trendAnalyzers.calculateTrend(mockHistoricalData, 'steps');
      const consistency = trendAnalyzers.analyzeConsistency(mockHistoricalData, 'steps');
      
      expect(['increasing', 'decreasing', 'stable']).toContain(trend);
      expect(consistency).toBeGreaterThanOrEqual(0);
      expect(consistency).toBeLessThanOrEqual(1);
    });

    it('allows simulation of trend analysis results', () => {
      simulateTrendAnalysis('steps', 'increasing', 0.85);

      const trend = trendAnalyzers.calculateTrend(mockHistoricalData, 'steps');
      const consistency = trendAnalyzers.analyzeConsistency(mockHistoricalData, 'steps');
      
      expect(trend).toBe('increasing');
      expect(consistency).toBe(0.85);
    });
  });

  describe('Progress Calculation', () => {
    it('calculates progress towards goals', () => {
      const metric = healthMetrics.steps;
      const progress = metric.calculateProgress(8000, 10000);
      
      expect(progress).toBe(0.8);
    });

    it('handles heart rate progress differently', () => {
      const metric = healthMetrics.heart_rate;
      const progress = metric.calculateProgress(75, 75); // Perfect match
      const lowProgress = metric.calculateProgress(50, 75); // Too low
      const highProgress = metric.calculateProgress(100, 75); // Too high
      
      expect(progress).toBe(1);
      expect(lowProgress).toBe(0);
      expect(highProgress).toBe(0);
    });
  });

  describe('Value Formatting', () => {
    it('formats values according to metric type', () => {
      const stepsFormatted = healthMetrics.steps.formatValue(10000);
      const heartRateFormatted = healthMetrics.heart_rate.formatValue(75);
      
      expect(stepsFormatted).toBe('10,000');
      expect(heartRateFormatted).toBe('75');
    });
  });
});
