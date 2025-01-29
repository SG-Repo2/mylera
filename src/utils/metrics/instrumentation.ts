import { z } from 'zod';
import type { MetricType } from '@/src/types/schemas';

// Performance metrics schema
const PerformanceMetricSchema = z.object({
  operation: z.string(),
  duration: z.number(),
  timestamp: z.string(),
  success: z.boolean(),
  errorType: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>;

// Error categories
export enum MetricErrorCategory {
  VALIDATION = 'validation',
  DATABASE = 'database',
  NETWORK = 'network',
  CALCULATION = 'calculation',
  UNKNOWN = 'unknown'
}

// In-memory storage for metrics (could be replaced with proper APM solution)
class MetricsInstrumentation {
  private static instance: MetricsInstrumentation;
  private performanceMetrics: PerformanceMetric[] = [];
  private errorCounts: Record<MetricErrorCategory, number> = {
    [MetricErrorCategory.VALIDATION]: 0,
    [MetricErrorCategory.DATABASE]: 0,
    [MetricErrorCategory.NETWORK]: 0,
    [MetricErrorCategory.CALCULATION]: 0,
    [MetricErrorCategory.UNKNOWN]: 0
  };

  private constructor() {}

  static getInstance(): MetricsInstrumentation {
    if (!this.instance) {
      this.instance = new MetricsInstrumentation();
    }
    return this.instance;
  }

  // Measure execution time of an operation
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const startTime = performance.now();
    let success = true;
    let errorType: string | undefined;

    try {
      const result = await fn();
      return result;
    } catch (error) {
      success = false;
      errorType = this.categorizeError(error);
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      this.recordMetric({
        operation,
        duration,
        timestamp: new Date().toISOString(),
        success,
        errorType,
        metadata
      });
    }
  }

  // Record a performance metric
  private recordMetric(metric: PerformanceMetric): void {
    try {
      const validatedMetric = PerformanceMetricSchema.parse(metric);
      this.performanceMetrics.push(validatedMetric);
      
      // Keep only last 1000 metrics
      if (this.performanceMetrics.length > 1000) {
        this.performanceMetrics.shift();
      }

      if (!validatedMetric.success && validatedMetric.errorType) {
        this.incrementErrorCount(validatedMetric.errorType as MetricErrorCategory);
      }

      // Log metric for monitoring (could be replaced with proper APM solution)
      console.debug('[Metrics]', {
        ...validatedMetric,
        duration: `${Math.round(validatedMetric.duration)}ms`
      });
    } catch (error) {
      console.error('Invalid metric format:', error);
    }
  }

  // Categorize errors
  private categorizeError(error: unknown): MetricErrorCategory {
    if (error instanceof Error) {
      if (error.name === 'MetricValidationError') {
        return MetricErrorCategory.VALIDATION;
      }
      if (error.name === 'PostgrestError') {
        return MetricErrorCategory.DATABASE;
      }
      if (error.name === 'NetworkError' || error.name === 'TimeoutError') {
        return MetricErrorCategory.NETWORK;
      }
    }
    return MetricErrorCategory.UNKNOWN;
  }

  // Increment error count for category
  private incrementErrorCount(category: MetricErrorCategory): void {
    this.errorCounts[category]++;
  }

  // Get performance metrics for analysis
  getPerformanceMetrics(): PerformanceMetric[] {
    return this.performanceMetrics;
  }

  // Get error counts by category
  getErrorCounts(): Record<MetricErrorCategory, number> {
    return { ...this.errorCounts };
  }

  // Calculate average operation duration
  getAverageOperationDuration(operation: string): number {
    const metrics = this.performanceMetrics.filter(
      metric => metric.operation === operation && metric.success
    );
    
    if (metrics.length === 0) return 0;
    
    const total = metrics.reduce((sum, metric) => sum + metric.duration, 0);
    return total / metrics.length;
  }

  // Get error rate for an operation
  getOperationErrorRate(operation: string): number {
    const metrics = this.performanceMetrics.filter(
      metric => metric.operation === operation
    );
    
    if (metrics.length === 0) return 0;
    
    const errors = metrics.filter(metric => !metric.success).length;
    return errors / metrics.length;
  }

  // Clear metrics (useful for testing)
  clearMetrics(): void {
    this.performanceMetrics = [];
    Object.keys(this.errorCounts).forEach(key => {
      this.errorCounts[key as MetricErrorCategory] = 0;
    });
  }
}

export const metricsInstrumentation = MetricsInstrumentation.getInstance();