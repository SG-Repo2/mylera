import type { MetricType } from '../types/schemas';

export interface MetricUpdate {
  userId: string;
  metricType: MetricType;
  value: number;
  timestamp: string;
}

interface BatchedUpdates {
  [userId: string]: {
    [metricType: string]: MetricUpdate;
  };
}

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

type BatchProcessor = (updates: MetricUpdate[]) => Promise<void>;

export class BatchUpdateManager {
  private batchedUpdates: BatchedUpdates = {};
  private timeoutId: NodeJS.Timeout | null = null;
  private readonly debounceMs: number;
  private readonly batchProcessor: BatchProcessor;
  private readonly maxBatchSize: number;
  private readonly retryOptions: RetryOptions;

  constructor(
    batchProcessor: BatchProcessor,
    options: { 
      debounceMs?: number;
      maxBatchSize?: number;
      retryOptions?: Partial<RetryOptions>;
    } = {}
  ) {
    this.batchProcessor = batchProcessor;
    this.debounceMs = options.debounceMs || 1000;
    this.maxBatchSize = options.maxBatchSize || 50;
    this.retryOptions = {
      maxRetries: options.retryOptions?.maxRetries ?? 3,
      baseDelayMs: options.retryOptions?.baseDelayMs ?? 1000,
      maxDelayMs: options.retryOptions?.maxDelayMs ?? 10000
    };
  }

  public queueUpdate(update: MetricUpdate): void {
    const { userId, metricType } = update;

    // Initialize user's batch if it doesn't exist
    if (!this.batchedUpdates[userId]) {
      this.batchedUpdates[userId] = {};
    }

    // Store only the latest update for each metric type
    this.batchedUpdates[userId][metricType] = update;

    // Schedule processing if not already scheduled
    this.scheduleBatchProcessing();
  }

  private scheduleBatchProcessing(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.processBatch();
    }, this.debounceMs);
  }

  private calculateBackoff(attempt: number): number {
    const { baseDelayMs, maxDelayMs } = this.retryOptions;
    const delay = Math.min(
      baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000, // Add jitter
      maxDelayMs
    );
    return delay;
  }

  private async processBatch(): Promise<void> {
    const updates = this.getBatchedUpdates();
    if (updates.length === 0) return;

    // Process updates in chunks
    for (let i = 0; i < updates.length; i += this.maxBatchSize) {
      const chunk = updates.slice(i, i + this.maxBatchSize);
      await this.processChunkWithRetry(chunk);
    }

    // Clear processed updates only after all chunks are processed
    this.batchedUpdates = {};
    this.timeoutId = null;
  }

  private async processChunkWithRetry(chunk: MetricUpdate[]): Promise<void> {
    const { maxRetries } = this.retryOptions;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.batchProcessor(chunk);
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Check if this is an auth/session error
        const isAuthError = 
          lastError.message.includes('PGRST202') ||
          lastError.message.includes('Invalid or expired session') ||
          lastError.message.includes('JWT') ||
          lastError.message.includes('authentication');

        // Don't retry auth errors
        if (isAuthError) {
          console.error(
            '[BatchUpdateManager] Authentication error - not retrying:',
            lastError.message
          );
          throw lastError;
        }
        
        // Log retry attempt
        console.warn(
          `[BatchUpdateManager] Processing attempt ${attempt}/${maxRetries} failed:`,
          lastError.message
        );

        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error(
            `[BatchUpdateManager] All ${maxRetries} retry attempts failed:`,
            lastError
          );
          throw lastError;
        }

        // Wait before next retry with exponential backoff
        const delayMs = this.calculateBackoff(attempt);
        console.log(
          `[BatchUpdateManager] Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  private getBatchedUpdates(): MetricUpdate[] {
    const updates: MetricUpdate[] = [];
    
    Object.values(this.batchedUpdates).forEach(userUpdates => {
      Object.values(userUpdates).forEach(update => {
        updates.push(update);
      });
    });

    return updates;
  }

  public clearBatch(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.batchedUpdates = {};
  }
} 