import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { metricsService } from '@/src/services/metricsService';
import type {
  MetricType,
  DailyMetricScore,
  MetricUpdate,
  MetricValidationError
} from '@/src/types/schemas';
import { validateMetricData, validateDisplayMetric } from '@/src/components/metrics/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MetricsState {
  // Daily metrics data
  dailyMetrics: Record<string, DailyMetricScore[]>;
  lastFetched: Record<string, number>;
  isLoading: boolean;
  error: Error | null;
  
  // Actions
  fetchDailyMetrics: (userId: string, date: string) => Promise<void>;
  updateMetric: (userId: string, update: MetricUpdate) => Promise<void>;
  clearError: () => void;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

export const useMetricsStore = create<MetricsState>()(
  persist(
    (set, get) => ({
      dailyMetrics: {},
      lastFetched: {},
      isLoading: false,
      error: null,

      fetchDailyMetrics: async (userId: string, date: string) => {
        const state = get();
        const cacheKey = `${userId}-${date}`;
        const lastFetchTime = state.lastFetched[cacheKey] || 0;
        const now = Date.now();

        // Return cached data if it's still fresh
        if (
          state.dailyMetrics[cacheKey] &&
          now - lastFetchTime < CACHE_DURATION
        ) {
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const metrics = await metricsService.getDailyMetrics(userId, date);
          
          set(state => ({
            dailyMetrics: {
              ...state.dailyMetrics,
              [cacheKey]: metrics
            },
            lastFetched: {
              ...state.lastFetched,
              [cacheKey]: now
            },
            isLoading: false
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error : new Error('Failed to fetch metrics'),
            isLoading: false
          });
        }
      },

      updateMetric: async (userId: string, update: MetricUpdate) => {
        const state = get();
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `${userId}-${today}`;

        // Optimistically update the UI
        const optimisticUpdate = (metrics: DailyMetricScore[]) => {
          const { points, goalReached } = metricsService.calculateMetricScore(
            update.value,
            update.goal
          );

          const updatedMetrics = metrics.map(metric =>
            metric.metric_type === update.type
              ? {
                  ...metric,
                  value: update.value,
                  goal: update.goal,
                  points,
                  goal_reached: goalReached,
                  updated_at: new Date().toISOString()
                }
              : metric
          );

          return updatedMetrics;
        };

        // Store the previous state for rollback
        const previousMetrics = state.dailyMetrics[cacheKey];

        // Apply optimistic update
        set(state => ({
          dailyMetrics: {
            ...state.dailyMetrics,
            [cacheKey]: previousMetrics ? optimisticUpdate(previousMetrics) : []
          }
        }));

        try {
          await metricsService.updateMetric(userId, update);
          
          // Refresh the data to ensure consistency
          await get().fetchDailyMetrics(userId, today);
        } catch (error) {
          // Rollback on failure
          set(state => ({
            dailyMetrics: {
              ...state.dailyMetrics,
              [cacheKey]: previousMetrics
            },
            error: error instanceof Error ? error : new Error('Failed to update metric')
          }));
        }
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'metrics-storage',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);

// Selector hooks for specific metrics data
export const useMetricsByDate = (userId: string, date: string): DailyMetricScore[] => {
  return useMetricsStore(state => {
    const cacheKey = `${userId}-${date}`;
    return state.dailyMetrics[cacheKey] || [];
  });
};

export const useMetricByType = (
  userId: string,
  date: string,
  type: MetricType
): DailyMetricScore | undefined => {
  return useMetricsStore(state => {
    const cacheKey = `${userId}-${date}`;
    const metrics = state.dailyMetrics[cacheKey] || [];
    return metrics.find(metric => metric.metric_type === type);
  });
};

export const useMetricsLoading = (): boolean => 
  useMetricsStore(state => state.isLoading);

export const useMetricsError = (): Error | null => 
  useMetricsStore(state => state.error);