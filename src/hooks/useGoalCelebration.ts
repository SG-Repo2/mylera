import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MetricType } from '@/src/types/schemas';
import { healthMetrics } from '@/src/config/healthMetrics';

interface CelebrationState {
  visible: boolean;
  metricType: MetricType;
  metricName: string;
  points: number;
}

interface StoredCelebration {
  metricType: string;
  timestamp: number;
}

export const useGoalCelebration = (userId: string | undefined) => {
  const [celebrationState, setCelebrationState] = useState<CelebrationState>({
    visible: false,
    metricType: 'steps',
    metricName: '',
    points: 0,
  });

  const isInitialLoad = useRef(true);
  const lastMetricsRef = useRef<Record<string, number>>({});

  const getCelebrationKey = useCallback(
    (date: string) => {
      return `celebrations_${userId}_${date}`;
    },
    [userId]
  );

  const isSameDay = (timestamp1: number, timestamp2: number) => {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const loadCelebratedMetrics = useCallback(async () => {
    if (!userId) return new Set<string>();
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = getCelebrationKey(today);
      const stored = await AsyncStorage.getItem(key);

      if (stored) {
        const celebrations: StoredCelebration[] = JSON.parse(stored);
        const now = Date.now();

        // Filter out celebrations from previous days
        const validCelebrations = celebrations.filter(c => isSameDay(c.timestamp, now));

        return new Set<string>(validCelebrations.map(c => c.metricType));
      }
      return new Set<string>();
    } catch (error) {
      console.error('[useGoalCelebration] Error loading celebrated metrics:', error);
      return new Set<string>();
    }
  }, [userId, getCelebrationKey]);

  const saveCelebratedMetric = useCallback(
    async (metricType: MetricType) => {
      if (!userId) return;
      try {
        const today = new Date().toISOString().split('T')[0];
        const key = getCelebrationKey(today);
        const celebrated = await loadCelebratedMetrics();

        const celebrations: StoredCelebration[] = Array.from(celebrated).map(type => ({
          metricType: type,
          timestamp: Date.now(),
        }));

        celebrations.push({
          metricType,
          timestamp: Date.now(),
        });

        await AsyncStorage.setItem(key, JSON.stringify(celebrations));
      } catch (error) {
        console.error('[useGoalCelebration] Error saving celebrated metric:', error);
      }
    },
    [userId, getCelebrationKey, loadCelebratedMetrics]
  );

  const checkAndCelebrateGoal = useCallback(
    async (metricType: MetricType, value: number, isRefresh: boolean = false) => {
      if (!userId || value <= 0 || isInitialLoad.current || isRefresh) {
        return false;
      }

      try {
        const celebrated = await loadCelebratedMetrics();
        if (celebrated.has(metricType)) return false;

        // Check if this is a genuine increase rather than a reload
        const lastValue = lastMetricsRef.current[metricType] || 0;
        if (value <= lastValue) return false;

        const config = healthMetrics[metricType];
        if (value >= config.defaultGoal) {
          // Only celebrate if we've crossed the threshold since last check
          if (lastValue < config.defaultGoal) {
            const points = Math.min(
              Math.floor(value / config.pointIncrement.value),
              config.pointIncrement.maxPoints
            );

            setCelebrationState({
              visible: true,
              metricType,
              metricName: config.title.toLowerCase(),
              points,
            });

            await saveCelebratedMetric(metricType);
            return true;
          }
        }
      } catch (error) {
        console.error('[useGoalCelebration] Error checking goal:', error);
      }
      return false;
    },
    [userId, loadCelebratedMetrics, saveCelebratedMetric]
  );

  // Track metric values between renders
  const updateLastMetrics = useCallback((metrics: Record<string, number>) => {
    lastMetricsRef.current = metrics;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
    }
  }, []);

  const closeCelebration = useCallback(() => {
    setCelebrationState(prev => ({ ...prev, visible: false }));
  }, []);

  return {
    celebrationState,
    checkAndCelebrateGoal,
    closeCelebration,
    updateLastMetrics,
  };
};
