import { useState, useEffect, useMemo } from 'react';
import { Animated } from 'react-native';
import { MetricType } from '@/src/types/metrics';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { useErrorHandler } from './useErrorHandler';

export interface DataPoint {
  date: string;
  value: number;
  animation: Animated.Value;
  dayName: string;
  isToday: boolean;
  isEmpty: boolean;
}

/**
 * Custom hook for fetching and processing bar chart data
 * 
 * @param provider The health provider instance
 * @param metricType The type of metric to fetch data for
 * @param userId The user ID to fetch data for
 * @param date The date to fetch data for
 * @returns Object containing chart data and loading state
 */
export const useBarChartData = (
  provider: HealthProvider,
  metricType: MetricType,
  userId: string,
  date: string
) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DataPoint[]>([]);
  const { error, handleError, clearError } = useErrorHandler();

  // Calculate chart metrics using useMemo
  const chartMetrics = useMemo(() => {
    if (data.length === 0) {
      return {
        validData: [],
        maxValue: 1,
        minValue: 0,
        yMin: 0,
        yMax: 1,
        range: 1
      };
    }

    const validData = data.map(d => ({
      ...d,
      value: typeof d.value === 'number' && !isNaN(d.value) ? d.value : 0
    }));

    const maxValue = Math.max(...validData.map(d => d.value), 1);
    const minValue = Math.min(...validData.map(d => d.value));
    const padding = Math.max((maxValue - minValue) * 0.1, 1);
    const yMax = maxValue + padding;
    const yMin = Math.max(0, minValue - padding);
    const range = Math.max(yMax - yMin, 1);

    return {
      validData,
      maxValue,
      minValue,
      yMin,
      yMax,
      range
    };
  }, [data]);

  // Fetch data when the component mounts or when dependencies change
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    clearError();

    const fetchData = async () => {
      try {
        console.log('[useBarChartData] Fetching health data for:', { userId, metricType });
        
        // Initialize provider
        await provider.initialize();

        // Get current date and date range for the past 7 days
        const endDateTime = new Date();
        const startDateTime = new Date();
        startDateTime.setDate(startDateTime.getDate() - 6);

        const endDateStr = endDateTime.toLocaleDateString('en-CA');
        const startDateStr = startDateTime.toLocaleDateString('en-CA');

        console.log('[useBarChartData] Date range:', { startDateStr, endDateStr });

        // Get native health data for the full range
        const rawData = await provider.fetchRawMetrics(
          startDateTime,
          endDateTime,
          [metricType]
        );

        const normalizedData = provider.normalizeMetrics(rawData, metricType);
        console.log('[useBarChartData] Health data count:', normalizedData.length);

        // Create a map of daily totals from native data
        const nativeDataMap = new Map<string, number>();
        normalizedData.forEach(metric => {
          const day = new Date(metric.timestamp).toLocaleDateString('en-CA');
          const currentTotal = nativeDataMap.get(day) || 0;
          nativeDataMap.set(day, currentTotal + metric.value);
        });

        // Fill data starting from current day going back 6 days
        const filledData: DataPoint[] = [];
        for (let i = -6; i <= 0; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const dateStr = d.toLocaleDateString('en-CA');
          
          // Get value directly from native data
          const value = nativeDataMap.get(dateStr) || 0;
          
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayName = days[d.getDay()];
          
          const isToday = i === 0;
          const isYesterday = i === -1;
          
          filledData.push({
            date: dateStr,
            value,
            dayName: isToday ? `${dayName}\nToday` : 
                    isYesterday ? `${dayName}\nYest.` : 
                    dayName,
            isToday,
            isEmpty: value === 0,
            animation: new Animated.Value(0)
          });
        }

        if (mounted) {
          setData(filledData);
          setLoading(false);

          // Enhanced staggered animation sequence
          const animations = filledData.map((item, index) =>
            Animated.sequence([
              Animated.delay(index * 60),
              Animated.spring(item.animation, {
                toValue: 1,
                useNativeDriver: false, // Changed to false because we're animating height
                stiffness: 180,
                damping: 12,
                mass: 0.8,
              })
            ])
          );

          Animated.stagger(40, animations).start();
        }
      } catch (err) {
        if (!mounted) return;
        console.error('[useBarChartData] Error fetching health data:', err);
        handleError(err);
        setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [metricType, userId, date, provider, clearError, handleError]);

  return {
    loading,
    error,
    data,
    chartMetrics
  };
};
