/**
 * Tests for Metrics Service Transaction Wrapper
 */
import { 
    metricsService, 
    withTransaction, 
    MetricsAuthError, 
    TransactionError 
  } from '@/src/services/metricsService';
  import { supabase } from '@/src/services/supabaseClient';
  import { logger } from '@/src/utils/logger';
  import { callWithTimeout, DEFAULT_TIMEOUTS } from '@/src/utils/asyncUtils';

  
  // Mock dependencies
  jest.mock('@/src/services/supabaseClient', () => ({
    supabase: {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      }),
      rpc: jest.fn(),
      auth: {
        getSession: jest.fn(),
      },
    },
  }));
  
  jest.mock('../../utils/asyncUtils', () => ({
    callWithTimeout: jest.fn((promise) => promise),
    DEFAULT_TIMEOUTS: {
      METRICS_FETCH: 15000,
    },
  }));
  
  jest.mock('../../utils/logger', () => ({
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    LogCategory: {
      Metrics: 'metrics',
      Database: 'database',
    },
  }));
  
  jest.mock('../../utils/scoringUtils', () => ({
    validateMetricValue: jest.fn().mockReturnValue(true),
    calculateMetricPoints: jest.fn().mockReturnValue({
      points: 100,
      goalReached: true,
    }),
  }));
  
  jest.mock('../../config/healthMetrics', () => ({
    healthMetrics: {
      steps: {
        defaultGoal: 10000,
        unit: 'steps',
      },
      distance: {
        defaultGoal: 5000,
        unit: 'm',
      },
      calories: {
        defaultGoal: 500,
        unit: 'kcal',
      },
      heart_rate: {
        defaultGoal: 75,
        unit: 'bpm',
      },
    },
  }));
  
  describe('Metrics Service', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      
      // Mock global setTimeout
      jest.useFakeTimers();
      
      // Setup auth mock to return a valid session by default
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-123',
            },
          },
        },
        error: null,
      });
      
      // Setup transaction RPC mock
      (supabase.rpc as jest.Mock).mockImplementation((method: string) => {
        switch (method) {
          case 'begin_transaction':
          case 'commit_transaction':
          case 'rollback_transaction':
            return Promise.resolve({ error: null });
          default:
            return Promise.resolve({ error: new Error(`Unknown RPC method: ${method}`) });
        }
      });
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
  
    describe('withTransaction', () => {
      it('should successfully execute an operation within a transaction', async () => {
        // Test operation
        const operation = jest.fn().mockResolvedValue('success');
        
        // Execute with transaction
        const result = await withTransaction(operation, 'test-op', 'test-user');
        
        // Verify transaction flow
        expect(supabase.rpc).toHaveBeenCalledWith(
          'begin_transaction',
          expect.any(Object)
        );
        expect(operation).toHaveBeenCalledTimes(1);
        expect(supabase.rpc).toHaveBeenCalledWith('commit_transaction');
        expect(supabase.rpc).not.toHaveBeenCalledWith('rollback_transaction');
        
        // Verify result
        expect(result).toBe('success');
        
        // Verify logging
        expect(logger.debug).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('Starting transaction'),
          'test-op',
          'test-user'
        );
        expect(logger.debug).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('Transaction completed successfully'),
          'test-op',
          'test-user'
        );
      });
  
      it('should roll back the transaction on operation error', async () => {
        // Test operation that throws an error
        const operationError = new Error('Operation failed');
        const operation = jest.fn().mockRejectedValue(operationError);
        
        // Execute with transaction and expect it to throw
        await expect(
          withTransaction(operation, 'test-op', 'test-user')
        ).rejects.toThrow(operationError);
        
        // Verify transaction flow
        expect(supabase.rpc).toHaveBeenCalledWith(
          'begin_transaction',
          expect.any(Object)
        );
        expect(operation).toHaveBeenCalledTimes(1);
        expect(supabase.rpc).not.toHaveBeenCalledWith('commit_transaction');
        expect(supabase.rpc).toHaveBeenCalledWith('rollback_transaction');
        
        // Verify logging
        expect(logger.debug).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('Rolling back transaction due to error'),
          'test-op',
          'test-user',
          expect.any(Object)
        );
      });
  
      it('should retry on retryable transaction errors', async () => {
        // Mock setTimeout to execute immediately
        jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
          callback();
          return {} as any;
        });
        
        // Create a retryable error
        const retryableError = new TransactionError(
          'Deadlock detected', 
          true, 
          '40P01'
        );
        
        // Test operation that fails once then succeeds
        const operation = jest.fn()
          .mockRejectedValueOnce(retryableError)
          .mockResolvedValueOnce('success after retry');
        
        // Execute with transaction
        const result = await withTransaction(operation, 'test-op', 'test-user');
        
        // Verify retry behavior
        expect(operation).toHaveBeenCalledTimes(2);
        expect(supabase.rpc).toHaveBeenCalledWith('rollback_transaction');
        expect(supabase.rpc).toHaveBeenCalledWith('commit_transaction');
        
        // Verify result
        expect(result).toBe('success after retry');
        
        // Verify retry logging
        expect(logger.debug).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('Retrying transaction'),
          'test-op',
          'test-user',
          expect.objectContaining({ 
            retryCount: 1,
            maxRetries: expect.any(Number),
            delay: expect.any(Number)
          })
        );
      });
  
      it('should not retry on non-retryable errors', async () => {
        // Create a non-retryable error
        const nonRetryableError = new Error('Non-retryable error');
        
        // Test operation that throws a non-retryable error
        const operation = jest.fn().mockRejectedValue(nonRetryableError);
        
        // Execute with transaction and expect it to throw
        await expect(
          withTransaction(operation, 'test-op', 'test-user')
        ).rejects.toThrow(nonRetryableError);
        
        // Verify no retry was attempted
        expect(operation).toHaveBeenCalledTimes(1);
        expect(logger.debug).not.toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('Retrying transaction'),
          expect.any(String),
          expect.any(String),
          expect.any(Object)
        );
      });
  
      it('should not retry on auth errors', async () => {
        // Create an auth error
        const authError = new MetricsAuthError('Not authenticated');
        
        // Test operation that throws an auth error
        const operation = jest.fn().mockRejectedValue(authError);
        
        // Execute with transaction and expect it to throw
        await expect(
          withTransaction(operation, 'test-op', 'test-user')
        ).rejects.toThrow(authError);
        
        // Verify no retry was attempted
        expect(operation).toHaveBeenCalledTimes(1);
        expect(logger.debug).not.toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('Retrying transaction'),
          expect.any(String),
          expect.any(String),
          expect.any(Object)
        );
      });
  
      it('should apply exponential backoff between retries', async () => {
        // Mock setTimeout to track delay values
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        
        const retryableError = new TransactionError(
          'Deadlock detected', 
          true, 
          '40P01'
        );
        
        const operation = jest.fn().mockRejectedValue(retryableError);
        
        // Execute operation and advance timers
        const transactionPromise = withTransaction(operation, 'test-op', 'test-user');
        
        // Advance timers for each retry
        for (let i = 0; i < 3; i++) {
          jest.advanceTimersByTime(500 * Math.pow(2, i));
          await Promise.resolve(); // Flush promises
        }
        
        await expect(transactionPromise).rejects.toThrow(/Transaction failed after/);
        
        expect(setTimeoutSpy).toHaveBeenCalledTimes(3);
        expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 500);
        expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 1000);
        expect(setTimeoutSpy).toHaveBeenNthCalledWith(3, expect.any(Function), 2000);
      }, 15000);
  
      it('should handle begin transaction errors', async () => {
        // Mock begin_transaction to fail
        (supabase.rpc as jest.Mock).mockImplementation((method: string) => {
          if (method === 'begin_transaction') {
            return Promise.resolve({ 
              error: { 
                message: 'Failed to begin transaction',
                code: '55P03' // lock_not_available (retryable)
              } 
            });
          }
          return Promise.resolve({ error: null });
        });
        
        // Test operation (should not be called)
        const operation = jest.fn().mockResolvedValue('success');
        
        // Mock setTimeout to execute immediately
        jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
          callback();
          return {} as any;
        });
        
        // Execute with transaction and expect it to throw after max retries
        await expect(
          withTransaction(operation, 'test-op', 'test-user')
        ).rejects.toThrow(/Transaction failed after/);
        
        // Verify transaction flow
        expect(supabase.rpc).toHaveBeenCalledWith(
          'begin_transaction',
          expect.any(Object)
        );
        expect(operation).not.toHaveBeenCalled();
        expect(supabase.rpc).not.toHaveBeenCalledWith('commit_transaction');
        
        // Verify error logging
        expect(logger.error).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('Failed to begin transaction'),
          'test-op',
          'test-user',
          expect.any(Object)
        );
      });
  
      it('should handle commit transaction errors', async () => {
        // Setup commit_transaction to fail
        (supabase.rpc as jest.Mock).mockImplementation((method: string) => {
          if (method === 'commit_transaction') {
            return Promise.resolve({ 
              error: { 
                message: 'Failed to commit transaction',
                code: '40001' // serialization_failure (retryable)
              } 
            });
          }
          return Promise.resolve({ error: null });
        });
        
        // Test operation
        const operation = jest.fn().mockResolvedValue('success');
        
        // Mock setTimeout to execute immediately
        jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
          callback();
          return {} as any;
        });
        
        // Execute with transaction and expect it to throw after max retries
        await expect(
          withTransaction(operation, 'test-op', 'test-user')
        ).rejects.toThrow(/Transaction failed after/);
        
        // Verify transaction flow
        expect(supabase.rpc).toHaveBeenCalledWith(
          'begin_transaction',
          expect.any(Object)
        );
        expect(operation).toHaveBeenCalled();
        expect(supabase.rpc).toHaveBeenCalledWith('commit_transaction');
        
        // Verify error logging
        expect(logger.error).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('Failed to commit transaction'),
          'test-op',
          'test-user',
          expect.any(Object)
        );
      });
    });
  
    describe('updateMetric', () => {
      const userId = 'test-user-123';
      const metricType = 'steps';
      const metricValue = 10000;
      
      // Mock from().upsert().select()
      const mockUpsertSelect = jest.fn().mockResolvedValue({
        data: [{ id: 'metric-1' }],
        error: null,
      });
      
      // Mock from().select() for metrics query
      const mockMetricsSelect = jest.fn().mockResolvedValue({
        data: [
          { points: 100, goal_reached: true, metric_type: 'steps', value: 10000 },
        ],
        error: null,
      });
      
      // Mock from().upsert().select() for daily total
      const mockTotalSelect = jest.fn().mockResolvedValue({
        data: [{ id: 'total-1' }],
        error: null,
      });
      
      beforeEach(() => {
        // Setup supabase from() to return appropriate mocks
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'daily_metric_scores') {
            return {
              upsert: jest.fn().mockReturnValue({
                select: mockUpsertSelect,
              }),
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue(mockMetricsSelect),
                }),
              }),
            };
          }
          if (table === 'daily_totals') {
            return {
              upsert: jest.fn().mockReturnValue({
                select: mockTotalSelect,
              }),
            };
          }
          return {
            select: jest.fn().mockReturnThis(),
            upsert: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
          };
        });
      });
  
      it('should update a metric with transaction support', async () => {
        // Execute updateMetric
        const result = await metricsService.updateMetric(userId, metricType, metricValue);
        
        // Verify transaction was used
        expect(supabase.rpc).toHaveBeenCalledWith(
          'begin_transaction',
          expect.any(Object)
        );
        expect(supabase.rpc).toHaveBeenCalledWith('commit_transaction');
        
        // Verify result
        expect(result).toEqual([{ id: 'total-1' }]);
      });
  
      it('should verify user authentication before updating metrics', async () => {
        // Mock auth to return no session
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
          data: { session: null },
          error: null,
        });
        
        // Execute updateMetric and expect it to throw
        await expect(
          metricsService.updateMetric(userId, metricType, metricValue)
        ).rejects.toThrow(MetricsAuthError);
        
        // Verify transaction was used and rolled back
        expect(supabase.rpc).toHaveBeenCalledWith(
          'begin_transaction',
          expect.any(Object)
        );
        expect(supabase.rpc).toHaveBeenCalledWith('rollback_transaction');
      });
  
      it('should verify userId matches authenticated user', async () => {
        // Mock auth to return different user ID
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'different-user-456',
              },
            },
          },
          error: null,
        });
        
        // Execute updateMetric and expect it to throw
        await expect(
          metricsService.updateMetric(userId, metricType, metricValue)
        ).rejects.toThrow(MetricsAuthError);
        
        // Verify transaction was used and rolled back
        expect(supabase.rpc).toHaveBeenCalledWith(
          'begin_transaction',
          expect.any(Object)
        );
        expect(supabase.rpc).toHaveBeenCalledWith('rollback_transaction');
      });
  
      it('should handle metric upsert errors', async () => {
        // Mock upsert to return an error
        mockUpsertSelect.mockResolvedValue({
          data: null,
          error: {
            message: 'Database error',
            code: '23505', // unique_violation (non-retryable)
          },
        });
        
        // Execute updateMetric and expect it to throw
        await expect(
          metricsService.updateMetric(userId, metricType, metricValue)
        ).rejects.toThrow();
        
        // Verify transaction was used and rolled back
        expect(supabase.rpc).toHaveBeenCalledWith(
          'begin_transaction',
          expect.any(Object)
        );
        expect(supabase.rpc).toHaveBeenCalledWith('rollback_transaction');
      });
  
      it('should handle permission errors with specific error type', async () => {
        // Mock upsert to return a permission error
        mockUpsertSelect.mockResolvedValue({
          data: null,
          error: {
            message: 'Permission denied',
            code: '42501', // insufficient_privilege
          },
        });
        
        // Execute updateMetric and expect it to throw
        await expect(
          metricsService.updateMetric(userId, metricType, metricValue)
        ).rejects.toThrow(MetricsAuthError);
        
        // Verify error was logged
        expect(logger.error).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('Error upserting metric'),
          expect.any(String),
          userId,
          expect.any(Object)
        );
      });
    });
  });
