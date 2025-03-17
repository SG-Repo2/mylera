import { useState, useEffect, useCallback } from 'react';
import { MetricType } from '@/src/types/metrics';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { useErrorHandler } from './useErrorHandler';

export interface TrendData {
  direction: 'up' | 'down' | 'neutral';
  percentage: number;
}

/**
 * Group metrics by day and calculate daily totals
 */
const groupMetricsByDay = (metrics: any[]): Record<string, number> => {
  const dailyTotals: Record<string, number> = {};
  
  metrics.forEach(metric => {
    const date = new Date(metric.timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (!dailyTotals[dateStr]) {
      dailyTotals[dateStr] = 0;
    }
    
    dailyTotals[dateStr] += metric.value;
  });
  
  return dailyTotals;
};

/**
 * Custom hook for fetching and processing metric modal data
 * 
 * @param provider The health provider instance
 * @param metricType The type of metric to fetch data for
 * @param currentValue The current value of the metric
 * @returns Object containing trend data and loading state
 */
export const useMetricModalData = (
  provider: HealthProvider,
  metricType: MetricType,
  currentValue: number | string
) => {
  const [isLoading, setIsLoading] = useState(true);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const { handleError } = useErrorHandler();

  /**
   * Calculate trend by comparing current value with historical data
   */
  const calculateTrend = useCallback(async (
    numericValue: number
  ): Promise<TrendData> => {
    try {
      // Get current date and date range for the past 7 days (excluding today)
      const today = new Date();
      const endDateTime = new Date(today);
      endDateTime.setDate(endDateTime.getDate() - 1); // Yesterday
      
      const startDateTime = new Date(today);
      startDateTime.setDate(startDateTime.getDate() - 7); // 7 days ago
      
      console.log(`[calculateTrend] Fetching data from ${startDateTime.toISOString()} to ${endDateTime.toISOString()}`);
      
      // Fetch historical data
      const rawData = await provider.fetchRawMetrics(
        startDateTime,
        endDateTime,
        [metricType]
      );
      
      // Normalize the data
      const normalizedData = provider.normalizeMetrics(rawData, metricType);
      console.log(`[calculateTrend] Found ${normalizedData.length} metrics for trend calculation`);
      
      if (normalizedData.length === 0) {
        console.log('[calculateTrend] No historical data found, returning neutral trend');
        return { direction: 'neutral', percentage: 0 };
      }
      
      // Group metrics by day to get daily totals
      const dailyTotals = groupMetricsByDay(normalizedData);
      const dailyValues = Object.values(dailyTotals);
      
      if (dailyValues.length === 0) {
        console.log('[calculateTrend] No daily values after grouping, returning neutral trend');
        return { direction: 'neutral', percentage: 0 };
      }
      
      // Calculate average of previous days
      const totalValue = dailyValues.reduce((sum, value) => sum + value, 0);
      const avgValue = totalValue / dailyValues.length;
      
      // Skip if average is zero to avoid division by zero
      if (avgValue === 0) {
        console.log('[calculateTrend] Average is zero, returning neutral trend');
        return { direction: 'neutral', percentage: 0 };
      }
      
      // Calculate percentage change
      const percentChange = ((numericValue - avgValue) / avgValue) * 100;
      
      // Determine trend direction
      let direction: 'up' | 'down' | 'neutral';
      if (Math.abs(percentChange) < 5) {
        direction = 'neutral';
      } else {
        direction = percentChange > 0 ? 'up' : 'down';
      }
      
      return {
        direction,
        percentage: Math.abs(Math.round(percentChange))
      };
    } catch (error) {
      console.error('[calculateTrend] Error calculating trend:', error);
      return { direction: 'neutral', percentage: 0 };
    }
  }, [provider, metricType]);

  // Fetch trend data when the component mounts or when dependencies change
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    
    const fetchTrend = async () => {
      try {
        // Initialize provider if needed
        await provider.initialize();
        
        // Calculate trend based on historical data
        const numericValue = typeof currentValue === 'string' ? parseFloat(currentValue) : currentValue;
        
        const trendData = await calculateTrend(numericValue);
        
        if (isMounted) {
          setTrend(trendData);
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          handleError(error);
          setTrend({ direction: 'neutral', percentage: 0 });
          setIsLoading(false);
        }
      }
    };
    
    fetchTrend();
    
    return () => {
      isMounted = false;
    };
  }, [provider, metricType, currentValue, calculateTrend, handleError]);

  return {
    isLoading,
    trend
  };
};
