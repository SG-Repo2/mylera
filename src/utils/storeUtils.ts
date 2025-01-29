import { DailyMetricScore, MetricUpdate } from '../types/schemas';

export class StoreError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

export class ValidationError extends StoreError {
  constructor(message: string, public readonly validationErrors: unknown[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NetworkError extends StoreError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'NETWORK_ERROR', originalError);
    this.name = 'NetworkError';
  }
}

export class DatabaseError extends StoreError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'DATABASE_ERROR', originalError);
    this.name = 'DatabaseError';
  }
}

interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  let delay = finalConfig.initialDelay;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry validation errors
      if (error instanceof ValidationError) {
        throw error;
      }

      // Don't retry on final attempt
      if (attempt === finalConfig.maxAttempts) {
        break;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Calculate next delay with exponential backoff
      delay = Math.min(delay * finalConfig.backoffFactor, finalConfig.maxDelay);
    }
  }

  throw new NetworkError(
    `Operation failed after ${finalConfig.maxAttempts} attempts`,
    lastError
  );
}

export function validateMetricUpdate(update: MetricUpdate): void {
  const errors: string[] = [];

  if (!update.type) {
    errors.push('Metric type is required');
  }

  if (typeof update.value !== 'number' || update.value < 0) {
    errors.push('Metric value must be a non-negative number');
  }

  if (typeof update.goal !== 'number' || update.goal < 0) {
    errors.push('Metric goal must be a non-negative number');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid metric update', errors);
  }
}

export function validateDailyMetricScore(score: DailyMetricScore): void {
  const errors: string[] = [];

  if (!score.user_id) {
    errors.push('User ID is required');
  }

  if (!score.date) {
    errors.push('Date is required');
  }

  if (!score.metric_type) {
    errors.push('Metric type is required');
  }

  if (typeof score.value !== 'number' || score.value < 0) {
    errors.push('Value must be a non-negative number');
  }

  if (typeof score.goal !== 'number' || score.goal < 0) {
    errors.push('Goal must be a non-negative number');
  }

  if (typeof score.points !== 'number' || score.points < 0 || score.points > 1000) {
    errors.push('Points must be between 0 and 1000');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid daily metric score', errors);
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}