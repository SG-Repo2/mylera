/**
 * Metrics Service with Transaction Support
 * 
 * This service handles health metrics data operations with robust
 * transaction support, timeout handling, and retry capabilities.
 */

import { supabase } from './supabaseClient';
import type { MetricType } from '../types/schemas';
import { healthMetrics } from '../config/healthMetrics';
import { validateMetricValue, calculateMetricPoints } from '../utils/scoringUtils';
import { logger, LogCategory } from '../utils/logger';
import { callWithTimeout } from '../utils/asyncUtils';

// Error types for different failure scenarios
export class MetricsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsAuthError';
  }
}

export class TransactionError extends Error {
  public isRetryable: boolean;
  public code?: string;
  
  constructor(message: string, isRetryable: boolean = false, code?: string) {
    super(message);
    this.name = 'TransactionError';
    this.isRetryable = isRetryable;
    this.code = code;
  }
}

// Configuration for transaction retries
const TRANSACTION_CONFIG = {
  TIMEOUT_MS: 15000,    // 15 seconds total transaction timeout
  STATEMENT_TIMEOUT_MS: 5000,  // 5 seconds statement timeout
};

// Configuration for retry behavior
const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 500,   // 500ms initial delay
  MAX_DELAY: 5000,   // 5 seconds maximum delay
};

/**
 * Executes a function within a database transaction with retry capabilities.
 * 
 * @param operation Function to execute within the transaction
 * @param operationId Identifier for logging
 * @param userId User ID for logging
 * @returns The result of the operation
 * @throws Error if the operation fails after all retries
 */
export async function withTransaction<T>(
  operation: () => Promise<T>,
  operationId: string,
  userId?: string
): Promise<T> {
  let retryCount = 0;
  let lastError: Error | null = null;
  
  // Keep retrying until max retries reached
  while (retryCount <= RETRY_CONFIG.MAX_RETRIES) {
    let transactionActive = false;
    
    try {
      logger.debug(
        LogCategory.Database,
        `Starting transaction${retryCount > 0 ? ` (retry ${retryCount}/${RETRY_CONFIG.MAX_RETRIES})` : ''}`,
        operationId,
        userId
      );
      
      // Start transaction with timeout
      const { error: beginError } = await callWithTimeout(
        Promise.resolve(supabase.rpc('begin_transaction', {
          statement_timeout: TRANSACTION_CONFIG.STATEMENT_TIMEOUT_MS
        })),
        TRANSACTION_CONFIG.TIMEOUT_MS,
        'Transaction begin timed out'
      );
      
      if (beginError) {
        logger.error(
          LogCategory.Database,
          `Failed to begin transaction`,
          operationId,
          userId,
          { error: beginError }
        );
        throw new TransactionError(
          `Failed to begin transaction: ${beginError.message}`,
          isRetryableError(beginError.code),
          beginError.code
        );
      }
      
      transactionActive = true;
      
      // Execute the operation within the transaction
      const result = await callWithTimeout(
        operation(),
        TRANSACTION_CONFIG.TIMEOUT_MS,
        'Transaction operation timed out'
      );
      
      // Commit the transaction
      
      const { error: commitError } = await callWithTimeout(
        Promise.resolve(supabase.rpc('commit_transaction')),
        TRANSACTION_CONFIG.TIMEOUT_MS,
        'Transaction commit timed out'
      );
      
      if (commitError) {
        logger.error(
          LogCategory.Database,
          `Failed to commit transaction`,
          operationId,
          userId,
          { error: commitError }
        );
        throw new TransactionError(
          `Failed to commit transaction: ${commitError.message}`,
          isRetryableError(commitError.code),
          commitError.code
        );
      }
      
      transactionActive = false;
      
      logger.debug(
        LogCategory.Database,
        `Transaction completed successfully`,
        operationId,
        userId
      );
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Roll back transaction if it's active
      if (transactionActive) {
        try {
          logger.debug(
            LogCategory.Database,
            `Rolling back transaction due to error`,
            operationId,
            userId,
            { error: lastError }
          );
          
          const { error: rollbackError } = await supabase.rpc('rollback_transaction');
          
          if (rollbackError) {
            logger.error(
              LogCategory.Database,
              `Failed to roll back transaction`,
              operationId,
              userId,
              { error: rollbackError }
            );
          }
        } catch (rollbackError) {
          logger.error(
            LogCategory.Database,
            `Error during transaction rollback`,
            operationId,
            userId,
            { error: rollbackError }
          );
        }
      }
      
      // Determine if error is retryable
      const isRetryable = error instanceof TransactionError && error.isRetryable;
      
      // Don't retry auth errors or non-retryable transaction errors
      if (error instanceof MetricsAuthError || !isRetryable) {
        throw error;
      }
      
      // Increment retry count
      retryCount++;
      
      // If we've reached max retries, throw the last error
      if (retryCount > RETRY_CONFIG.MAX_RETRIES) {
        throw new Error(`Transaction failed after ${RETRY_CONFIG.MAX_RETRIES} retries: ${lastError?.message}`);
      }
      
      // Wait with exponential backoff before retrying
      const delay = Math.min(
        RETRY_CONFIG.BASE_DELAY * Math.pow(2, retryCount - 1),
        RETRY_CONFIG.MAX_DELAY
      );
      
      logger.debug(
        LogCategory.Database,
        `Retrying transaction`,
        operationId,
        userId,
        { 
          retryCount, 
          maxRetries: RETRY_CONFIG.MAX_RETRIES, 
          delay 
        }
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never happen (while loop should either return or throw)
  throw new Error('Unexpected end of transaction retry loop');
}

/**
 * Determines if an error code represents a retryable database error
 */
function isRetryableError(code?: string): boolean {
  if (!code) return false;
  
  // Common retryable PostgreSQL error codes
  const retryableCodes = [
    '40001', // serialization_failure
    '40P01', // deadlock_detected
    '55P03', // lock_not_available
    '57014', // query_canceled (timeout)
    '57P01', // admin_shutdown
    '57P02', // crash_shutdown
    '57P03', // cannot_connect_now
    '08006', // connection_failure
    '08001', // sqlclient_unable_to_establish_sqlconnection
    '08004', // sqlserver_rejected_establishment_of_sqlconnection
    'XX000', // internal_error
  ];
  
  return retryableCodes.includes(code);
}

/**
 * Metrics Service for CRUD operations on health metrics data
 */
export const metricsService = {
  /**
   * Get user's daily metrics
   * @param userId User ID
   * @param date Date in YYYY-MM-DD format
   * @returns Array of daily metric scores
   */
  async getDailyMetrics(userId: string, date: string) {
    const operationId = `get-metrics-${Date.now()}`;
    
    logger.debug(
      LogCategory.Metrics,
      `Getting daily metrics`,
      operationId,
      userId,
      { date }
    );
    
    try {
      const { data, error } = await supabase
        .from('daily_metric_scores')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .eq('is_test_data', false);

      if (error) throw error;
      
      logger.debug(
        LogCategory.Metrics,
        `Daily metrics retrieved`,
        operationId,
        userId,
        { count: data?.length || 0 }
      );
      
      return data || [];
    } catch (error) {
      logger.error(
        LogCategory.Metrics,
        `Error getting daily metrics`,
        operationId,
        userId,
        { error, date }
      );
      throw error;
    }
  },

  /**
   * Get user's historical metrics for the last 7 days
   * @param userId User ID
   * @param metricType Type of metric
   * @param endDate End date in YYYY-MM-DD format
   * @returns Array of historical metrics
   */
  async getHistoricalMetrics(userId: string, metricType: MetricType, endDate: string) {
    const operationId = `get-historical-metrics-${Date.now()}`;
    
    // Ensure we're working with local dates
    const endDateTime = new Date(endDate);
    const startDateTime = new Date(endDate);
    startDateTime.setDate(startDateTime.getDate() - 6); // Get 7 days including end date
    
    // Format dates in YYYY-MM-DD format using local timezone
    const startDateStr = startDateTime.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format
    const endDateStr = endDateTime.toLocaleDateString('en-CA');
    
    logger.debug(
      LogCategory.Metrics,
      `Getting historical metrics`,
      operationId,
      userId,
      { metricType, startDate: startDateStr, endDate: endDateStr }
    );
    
    try {
      const { data, error } = await supabase
        .from('daily_metric_scores')
        .select('date, value')
        .eq('user_id', userId)
        .eq('metric_type', metricType)
        .eq('is_test_data', false)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true });

      if (error) throw error;
      
      logger.debug(
        LogCategory.Metrics,
        `Historical metrics retrieved`,
        operationId,
        userId,
        { metricType, count: data?.length || 0 }
      );
      
      return data || [];
    } catch (error) {
      logger.error(
        LogCategory.Metrics,
        `Error getting historical metrics`,
        operationId,
        userId,
        { error, metricType, endDate }
      );
      throw error;
    }
  },

  /**
   * Get daily totals for leaderboard
   * @param date Date in YYYY-MM-DD format
   * @returns Array of daily totals
   */
  async getDailyTotals(date: string) {
    const operationId = `get-daily-totals-${Date.now()}`;
    
    logger.debug(
      LogCategory.Metrics,
      `Getting daily totals`,
      operationId,
      undefined,
      { date }
    );
    
    try {
      const { data, error } = await supabase
        .from('daily_totals')
        .select(`
          *,
          user_profiles (
            display_name,
            avatar_url,
            show_profile
          )
        `)
        .eq('date', date)
        .eq('is_test_data', false)
        .order('total_points', { ascending: false });

      if (error) throw error;
      
      logger.debug(
        LogCategory.Metrics,
        `Daily totals retrieved`,
        operationId,
        undefined,
        { count: data?.length || 0 }
      );
      
      return data || [];
    } catch (error) {
      logger.error(
        LogCategory.Metrics,
        `Error getting daily totals`,
        operationId,
        undefined,
        { error, date }
      );
      throw error;
    }
  },

  /**
   * Update a single metric with transaction support and retries
   * @param userId User ID
   * @param metricType Type of metric
   * @param value Metric value
   * @returns Result of the update operation
   */
  async updateMetric(userId: string, metricType: MetricType, value: number) {
    const operationId = `update-metric-${metricType}-${Date.now()}`;
    
    // Add detailed logging for distance metrics
    if (metricType === 'distance') {
      logger.debug(
        LogCategory.Metrics,
        `Processing distance metric`,
        operationId,
        userId,
        {
          rawValue: value,
          valueType: typeof value,
          isNumber: !isNaN(value)
        }
      );
    }

    // Ensure value is a valid number
    const numericValue = Number(value);
    if (isNaN(numericValue)) {
      logger.error(
        LogCategory.Metrics,
        `Invalid metric value`,
        operationId,
        userId,
        { metricType, value }
      );
      throw new Error(`Invalid value for metric type ${metricType}`);
    }

    logger.info(
      LogCategory.Metrics,
      `Updating metric`,
      operationId,
      userId,
      {
        metricType,
        value: numericValue,
        valueType: typeof numericValue,
        timestamp: new Date().toISOString()
      }
    );

    try {
      // Execute update in a transaction with retries
      return await withTransaction(async () => {
        // Verify user is authenticated
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        const session = sessionData.session;
        if (!session?.user) {
          throw new MetricsAuthError('User must be authenticated to update metrics');
        }

        // Verify userId matches authenticated user
        if (session.user.id !== userId) {
          throw new MetricsAuthError('Cannot update metrics for another user');
        }

        // Validate metric value
        if (!validateMetricValue(metricType, numericValue)) {
          throw new Error(`Invalid value for metric type ${metricType}`);
        }

        const today = new Date().toISOString().split('T')[0];
        const config = healthMetrics[metricType];
        
        logger.debug(
          LogCategory.Metrics,
          `Metric config`,
          operationId,
          userId,
          {
            metricType,
            defaultGoal: config.defaultGoal,
            unit: config.unit
          }
        );
        
        // Calculate points and goal status using centralized scoring logic
        const { points, goalReached } = calculateMetricPoints(metricType, numericValue, config);

        logger.debug(
          LogCategory.Metrics,
          `Calculated score`,
          operationId,
          userId,
          {
            goalReached,
            points,
            value: numericValue,
            defaultGoal: config.defaultGoal
          }
        );
        
        // Prepare the metric data
        const metricData = {
          user_id: userId,
          date: today,
          metric_type: metricType,
          value: numericValue,
          points,
          goal_reached: goalReached,
          updated_at: new Date().toISOString(),
          is_test_data: false
        };

        logger.debug(
          LogCategory.Metrics,
          `Upserting metric data`,
          operationId,
          userId,
          metricData
        );

        // Update metric score
        const { data: upsertResult, error: metricError } = await supabase
          .from('daily_metric_scores')
          .upsert(metricData, {
            onConflict: 'user_id,date,metric_type'
          })
          .select();
      
        if (metricError) {
          logger.error(
            LogCategory.Metrics,
            `Error upserting metric`,
            operationId,
            userId,
            { error: metricError }
          );
          
          if (metricError.code === '42501') {
            throw new MetricsAuthError('Permission denied: Cannot update metrics for this user');
          }
          throw metricError;
        }

        logger.debug(
          LogCategory.Metrics,
          `Upsert result`,
          operationId,
          userId,
          { result: upsertResult }
        );

        // Get updated metrics for daily total
        const { data: metrics, error: fetchError } = await supabase
          .from('daily_metric_scores')
          .select('points, goal_reached, metric_type, value')
          .eq('user_id', userId)
          .eq('date', today);

        if (fetchError) {
          logger.error(
            LogCategory.Metrics,
            `Error fetching metrics`,
            operationId,
            userId,
            { error: fetchError }
          );
          throw fetchError;
        }

        logger.debug(
          LogCategory.Metrics,
          `Current metrics state`,
          operationId,
          userId,
          { metrics }
        );

        // Calculate totals using the actual stored values
        const totalPoints = metrics?.reduce((sum, m) => sum + m.points, 0) ?? 0;
        const metricsCompleted = metrics?.filter(m => m.goal_reached).length ?? 0;

        // Update daily total
        const { data: totalResult, error: totalError } = await supabase
          .from('daily_totals')
          .upsert({
            user_id: userId,
            date: today,
            total_points: totalPoints,
            metrics_completed: metricsCompleted,
            updated_at: new Date().toISOString(),
            is_test_data: false
          }, {
            onConflict: 'user_id,date'
          })
          .select();

        logger.debug(
          LogCategory.Metrics,
          `Daily total update result`,
          operationId,
          userId,
          {
            totalPoints,
            metricsCompleted,
            result: totalResult
          }
        );

        if (totalError) {
          if (totalError.code === '42501') {
            throw new MetricsAuthError('Permission denied: Cannot update daily totals for this user');
          }
          throw totalError;
        }
        
        return totalResult;
      }, operationId, userId);
    } catch (error) {
      logger.error(
        LogCategory.Metrics,
        `Error in updateMetric`,
        operationId,
        userId,
        { error, metricType, value: numericValue }
      );
      
      throw error;
    }
  }
};