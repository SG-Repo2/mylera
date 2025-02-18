import { MetricType } from '@/src/types/metrics';
import type { TestHealthData, TestErrorResponse } from '@/src/__tests__/types/test.types';

// Custom error classes
class MetricsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsAuthError';
  }
}

class MetricsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsValidationError';
  }
}

class MetricsNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsNetworkError';
  }
}

// Enhanced validation rules with detailed error messages
const metricValidationRules = {
  steps: {
    validate: (value: number) => value >= 0 && value <= 100000,
    message: 'Steps must be between 0 and 100,000'
  },
  distance: {
    validate: (value: number) => value >= 0 && value <= 100000,
    message: 'Distance must be between 0 and 100,000 meters'
  },
  calories: {
    validate: (value: number) => value >= 0 && value <= 10000,
    message: 'Calories must be between 0 and 10,000'
  },
  heart_rate: {
    validate: (value: number) => value >= 30 && value <= 220,
    message: 'Heart rate must be between 30 and 220 bpm'
  },
  exercise: {
    validate: (value: number) => value >= 0 && value <= 1440,
    message: 'Exercise minutes must be between 0 and 1,440 (24 hours)'
  },
  basal_calories: {
    validate: (value: number) => value >= 800 && value <= 4000,
    message: 'Basal calories must be between 800 and 4,000'
  },
  flights_climbed: {
    validate: (value: number) => value >= 0 && value <= 500,
    message: 'Flights climbed must be between 0 and 500'
  }
};

// Validation helper with detailed error reporting
const validateMetric = (metricType: MetricType, value: number): { isValid: boolean; error?: string } => {
  const rule = metricValidationRules[metricType];
  if (!rule) {
    return { isValid: false, error: `Unknown metric type: ${metricType}` };
  }
  return {
    isValid: rule.validate(value),
    error: rule.validate(value) ? undefined : rule.message
  };
};

// Enhanced network simulation settings
interface NetworkConditions {
  latency: number;
  reliability: number;
  errorRate: number;
  timeoutRate: number;
  timeoutDuration: number;
  rateLimitThreshold: number;
  rateLimitWindow: number;
}

let networkConditions: NetworkConditions = {
  latency: 200,
  reliability: 1,
  errorRate: 0,
  timeoutRate: 0,
  timeoutDuration: 5000,
  rateLimitThreshold: 100,
  rateLimitWindow: 60000 // 1 minute
};

// Rate limiting state
interface RateLimitState {
  requests: Map<string, number[]>;
  resetTimeout: NodeJS.Timeout | null;
}

const rateLimitState: RateLimitState = {
  requests: new Map<string, number[]>(),
  resetTimeout: null
};

// Clear rate limit state periodically
const resetRateLimits = () => {
  rateLimitState.requests.clear();
  if (rateLimitState.resetTimeout) {
    clearTimeout(rateLimitState.resetTimeout);
  }
  rateLimitState.resetTimeout = setTimeout(resetRateLimits, networkConditions.rateLimitWindow);
};

// Start rate limit tracking
resetRateLimits();

export const metricsService = {
  getDailyMetrics: jest.fn().mockResolvedValue([]),
  getHistoricalMetrics: jest.fn().mockResolvedValue([]),
  getDailyTotals: jest.fn().mockResolvedValue([]),
  updateMetric: jest.fn().mockResolvedValue({ data: null, error: null }),
  syncMetrics: jest.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  validateMetricData: jest.fn((metricType: MetricType, value: number) => {
    const result = validateMetric(metricType, value);
    if (!result.isValid && result.error) {
      throw new MetricsValidationError(result.error);
    }
    return result.isValid;
  }),
  getMetricStats: jest.fn().mockResolvedValue({
    min: 0,
    max: 0,
    avg: 0,
    trend: 'stable',
    consistency: 0
  })
};

// Enhanced reset helper with complete state reset
export const resetMetricsMocks = () => {
  Object.values(metricsService).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockClear();
    }
  });
  
  networkConditions = {
    latency: 200,
    reliability: 1,
    errorRate: 0,
    timeoutRate: 0,
    timeoutDuration: 5000,
    rateLimitThreshold: 100,
    rateLimitWindow: 60000
  };

  // Reset rate limit state
  rateLimitState.requests.clear();
  if (rateLimitState.resetTimeout) {
    clearTimeout(rateLimitState.resetTimeout);
  }
  rateLimitState.resetTimeout = setTimeout(resetRateLimits, networkConditions.rateLimitWindow);

  // Reset mock implementations to defaults
  metricsService.getDailyMetrics.mockResolvedValue([]);
  metricsService.getHistoricalMetrics.mockResolvedValue([]);
  metricsService.getDailyTotals.mockResolvedValue([]);
  metricsService.updateMetric.mockResolvedValue({ data: null, error: null });
  metricsService.syncMetrics.mockResolvedValue({ synced: 0, failed: 0 });
  metricsService.getMetricStats.mockResolvedValue({
    min: 0,
    max: 0,
    avg: 0,
    trend: 'stable',
    consistency: 0
  });
};

// Enhanced network simulation helpers
export const setNetworkConditions = (conditions: Partial<NetworkConditions>) => {
  networkConditions = {
    ...networkConditions,
    ...conditions,
    // Ensure values are within valid ranges
    latency: Math.max(0, conditions.latency ?? networkConditions.latency),
    reliability: Math.min(Math.max(0, conditions.reliability ?? networkConditions.reliability), 1),
    errorRate: Math.min(Math.max(0, conditions.errorRate ?? networkConditions.errorRate), 1),
    timeoutRate: Math.min(Math.max(0, conditions.timeoutRate ?? networkConditions.timeoutRate), 1),
    timeoutDuration: Math.max(1000, conditions.timeoutDuration ?? networkConditions.timeoutDuration)
  };
};

const simulateNetwork = async <T>(data: T, userId?: string): Promise<T> => {
  // Check rate limits if userId provided
  if (userId && networkConditions.rateLimitThreshold) {
    const now = Date.now();
    const userRequests = rateLimitState.requests.get(userId) || [];
    
    // Clean old requests
    const recentRequests = userRequests.filter(
      time => now - time < networkConditions.rateLimitWindow!
    );
    
    if (recentRequests.length >= networkConditions.rateLimitThreshold) {
      throw new MetricsNetworkError('Rate limit exceeded');
    }
    
    recentRequests.push(now);
    rateLimitState.requests.set(userId, recentRequests);
  }

  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, networkConditions.latency));

  // Simulate timeouts
  if (Math.random() < networkConditions.timeoutRate) {
    await new Promise((_, reject) => 
      setTimeout(() => reject(new MetricsNetworkError('Request timed out')), 
      networkConditions.timeoutDuration)
    );
  }

  // Simulate network errors
  if (Math.random() < networkConditions.errorRate) {
    throw new MetricsNetworkError('Network request failed');
  }

  // Simulate general reliability
  if (Math.random() > networkConditions.reliability) {
    throw new MetricsNetworkError('Connection lost');
  }

  return data;
};

// Exponential backoff retry helper
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (error instanceof MetricsNetworkError && error.message === 'Rate limit exceeded') {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  
  throw lastError || new Error('Max retry attempts reached');
};

// Helper to simulate metric update success with retry support
export const simulateMetricUpdate = async (
  userId: string,
  metricType: MetricType,
  value: number,
  points: number = 50,
  goalReached: boolean = true
) => {
  // Validate metric data
  if (!metricsService.validateMetricData(metricType, value)) {
    throw new MetricsValidationError(`Invalid value for ${metricType}: ${value}`);
  }

  return withRetry(async () => {
    const mockData = {
      user_id: userId,
      metric_type: metricType,
      value,
      points,
      goal_reached: goalReached,
      date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    };

    const response = await simulateNetwork({
      data: mockData,
      error: null
    }, userId);

    metricsService.updateMetric.mockResolvedValueOnce(response);
    return mockData;
  });
};

// Helper to simulate partial success
export const simulatePartialSuccess = (
  userId: string,
  metrics: Array<{ type: MetricType; value: number }>,
  successRate: number = 0.7
) => {
  const results = metrics.map(metric => {
    const success = Math.random() < successRate;
    return {
      metric_type: metric.type,
      value: metric.value,
      success,
      error: success ? null : new MetricsNetworkError('Failed to update metric')
    };
  });

  const successCount = results.filter(r => r.success).length;
  metricsService.syncMetrics.mockResolvedValueOnce({
    synced: successCount,
    failed: results.length - successCount,
    results
  });

  return results;
};

// Helper to simulate metric update error
export const simulateMetricError = (error: TestErrorResponse | string | Error) => {
  const errorObj = typeof error === 'string' ? new Error(error) : error;
  metricsService.updateMetric.mockRejectedValueOnce(errorObj);
};

// Helper to simulate auth error
export const simulateMetricAuthError = (message: string = 'User must be authenticated') => {
  const error = new MetricsAuthError(message);
  metricsService.updateMetric.mockRejectedValueOnce(error);
};

// Helper to simulate daily metrics
export const simulateDailyMetrics = async (
  userId: string,
  metrics: Array<{
    type: MetricType;
    value: number;
    points?: number;
    goalReached?: boolean;
  }>
) => {
  const mockData = metrics.map(metric => ({
    user_id: userId,
    metric_type: metric.type,
    value: metric.value,
    points: metric.points ?? 50,
    goal_reached: metric.goalReached ?? true,
    date: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString()
  }));

  const response = await simulateNetwork(mockData);
  metricsService.getDailyMetrics.mockResolvedValueOnce(response);
  return mockData;
};

// Helper to simulate historical metrics with trends
export const simulateHistoricalMetrics = async (
  userId: string,
  metricType: MetricType,
  days: number,
  baseValue: number,
  options: {
    variance?: number;
    trend?: 'increasing' | 'decreasing' | 'stable';
    trendStrength?: number;
  } = {}
) => {
  const {
    variance = 0.2,
    trend = 'stable',
    trendStrength = 0.1
  } = options;

  const mockData = Array.from({ length: days }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    
    // Apply trend
    const trendFactor = trend === 'stable' ? 1 :
      trend === 'increasing' ? (1 + (index / days) * trendStrength) :
      (1 - (index / days) * trendStrength);
    
    const randomVariance = 1 + (Math.random() * 2 - 1) * variance;
    const value = Math.round(baseValue * trendFactor * randomVariance);

    return {
      date: date.toISOString().split('T')[0],
      value: Math.max(0, value) // Ensure no negative values
    };
  });

  const response = await simulateNetwork(mockData);
  metricsService.getHistoricalMetrics.mockResolvedValueOnce(response);
  return mockData;
};

// Helper to simulate daily totals with achievements
export const simulateDailyTotals = async (
  userId: string,
  totalPoints: number = 100,
  metricsCompleted: number = 5,
  achievements: string[] = []
) => {
  const mockData = {
    user_id: userId,
    total_points: totalPoints,
    metrics_completed: metricsCompleted,
    achievements,
    date: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString()
  };

  const response = await simulateNetwork([mockData]);
  metricsService.getDailyTotals.mockResolvedValueOnce(response);
  return mockData;
};

export {
  MetricsAuthError,
  MetricsValidationError,
  MetricsNetworkError,
  metricValidationRules
};
