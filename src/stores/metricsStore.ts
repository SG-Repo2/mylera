import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyMetricScore, MetricType, MetricUpdate } from '../types/schemas';
import { metricsService } from '../services/metricsService';
import { HealthMetrics } from '../providers/health/types/metrics';
import { metricsCache } from '../utils/metrics/MetricsCache';
import {
  withRetry,
  validateMetricUpdate,
  validateDailyMetricScore,
  debounce,
  StoreError,
  ValidationError,
  NetworkError,
  DatabaseError
} from '../utils/storeUtils';

interface MetricsWindow {
  start: string;
  end: string;
}

interface MetricsState {
  metrics: HealthMetrics | null;
  dailyScores: DailyMetricScore[];
  loading: boolean;
  error: StoreError | null;
  lastSynced: string | null;
  pendingUpdates: Map<string, MetricUpdate>;
  window: MetricsWindow;
  
  // Actions
  setMetrics: (metrics: HealthMetrics) => void;
  setDailyScores: (scores: DailyMetricScore[]) => void;
  updateMetric: (userId: string, update: MetricUpdate) => Promise<void>;
  syncDailyMetrics: (userId: string, date: string) => Promise<void>;
  setWindow: (start: string, end: string) => Promise<void>;
  loadWindowData: (userId: string) => Promise<void>;
  retryPendingUpdates: () => Promise<void>;
  clearError: () => void;
}

const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 5000,
  backoffFactor: 2,
};

const SYNC_DEBOUNCE_MS = 1000;

// Create a debounced function that returns a Promise
const createDebouncedSync = () => {
  let currentPromise: Promise<void> | null = null;
  const debouncedFn = debounce((userId: string, date: string, set: any, get: any) => {
    currentPromise = (async () => {
      set({ loading: true, error: null });
      
      try {
        const scores = await withRetry(
          async () => {
            const result = await metricsService.getDailyMetrics(userId, date);
            result.forEach(validateDailyMetricScore);
            return result;
          },
          RETRY_CONFIG
        );

        // Cache the fetched data
        await metricsCache.set(userId, 'steps', scores, date, date);

        set({
          dailyScores: scores,
          lastSynced: new Date().toISOString(),
          loading: false,
        });
      } catch (error) {
        let storeError: StoreError;
        if (error instanceof ValidationError) {
          storeError = error;
        } else if (error instanceof Error && error.message.includes('42703')) {
          storeError = new DatabaseError(
            'Database schema is out of sync. Please contact support.',
            error
          );
        } else {
          storeError = new StoreError(
            'Failed to sync metrics',
            'SYNC_ERROR',
            error
          );
        }

        set({
          error: storeError,
          loading: false,
        });
      }
    })();
    return currentPromise;
  }, SYNC_DEBOUNCE_MS);

  return (userId: string, date: string, set: any, get: any) => {
    debouncedFn(userId, date, set, get);
    return currentPromise || Promise.resolve();
  };
};

const debouncedSync = createDebouncedSync();

export const useMetricsStore = create<MetricsState>()(
  persist(
    (set, get) => ({
      metrics: null,
      dailyScores: [],
      loading: false,
      error: null,
      lastSynced: null,
      pendingUpdates: new Map(),
      window: {
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
      },

      setMetrics: (metrics) => set({ metrics }),
      
      setDailyScores: (scores) => {
        try {
          scores.forEach(validateDailyMetricScore);
          set({ dailyScores: scores });
        } catch (error) {
          set({ 
            error: error instanceof ValidationError 
              ? error 
              : new ValidationError('Invalid daily metric scores', [String(error)])
          });
        }
      },
      
      clearError: () => set({ error: null }),

      setWindow: async (start: string, end: string) => {
        set({ window: { start, end } });
        metricsCache.setWindow(start, end);
        const state = get();
        if (state.dailyScores[0]?.user_id) {
          await get().loadWindowData(state.dailyScores[0].user_id);
        }
      },

      loadWindowData: async (userId: string) => {
        const { window } = get();
        set({ loading: true, error: null });

        try {
          // Try to get data from cache first
          const cachedData = await metricsCache.get(
            userId,
            'steps',
            window.start,
            window.end
          );

          if (cachedData) {
            set({ dailyScores: cachedData, loading: false });
            return;
          }

          // If not in cache, fetch from server
          const scores = await withRetry(
            async () => {
              const result = await metricsService.getDailyMetrics(userId, window.start);
              result.forEach(validateDailyMetricScore);
              return result;
            },
            RETRY_CONFIG
          );

          // Cache the fetched data
          await metricsCache.set(
            userId,
            'steps',
            scores,
            window.start,
            window.end
          );

          set({
            dailyScores: scores,
            lastSynced: new Date().toISOString(),
            loading: false,
          });
        } catch (error) {
          let storeError: StoreError;
          if (error instanceof ValidationError) {
            storeError = error;
          } else if (error instanceof Error && error.message.includes('42703')) {
            storeError = new DatabaseError(
              'Database schema is out of sync. Please contact support.',
              error
            );
          } else {
            storeError = new StoreError(
              'Failed to load metrics',
              'LOAD_ERROR',
              error
            );
          }

          set({
            error: storeError,
            loading: false,
          });
        }
      },

      updateMetric: async (userId, update) => {
        const currentDate = new Date().toISOString().split('T')[0];
        const updateKey = `${userId}-${update.type}-${currentDate}`;

        try {
          validateMetricUpdate(update);
          
          // Create optimistic update
          const optimisticScore: DailyMetricScore = {
            id: `temp-${Date.now()}`,
            user_id: userId,
            date: currentDate,
            metric_type: update.type,
            value: update.value,
            goal: update.goal,
            points: 0,
            goal_reached: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // Store pending update and apply optimistic update
          set(state => ({
            pendingUpdates: new Map(state.pendingUpdates).set(updateKey, update),
            dailyScores: [
              ...state.dailyScores.filter(
                score => 
                  score.metric_type !== update.type || 
                  score.date !== currentDate
              ),
              optimisticScore,
            ],
          }));

          // Attempt to sync with server
          await withRetry(
            async () => {
              await metricsService.updateMetric(userId, update);
              
              // Remove from pending updates on success
              set(state => {
                const pendingUpdates = new Map(state.pendingUpdates);
                pendingUpdates.delete(updateKey);
                return { pendingUpdates };
              });

              // Invalidate cache for this metric type
              await metricsCache.invalidate(userId, update.type);

              // Sync with server to get actual state
              await get().syncDailyMetrics(userId, currentDate);
            },
            RETRY_CONFIG
          );
        } catch (error) {
          // Handle specific error types
          let storeError: StoreError;
          if (error instanceof ValidationError) {
            storeError = error;
          } else if (error instanceof Error && error.message.includes('42703')) {
            storeError = new DatabaseError(
              'Database schema is out of sync. Please contact support.',
              error
            );
          } else if (error instanceof Error && error.message.includes('network')) {
            storeError = new NetworkError(
              'Failed to connect to the server. Please check your connection.',
              error
            );
          } else {
            storeError = new StoreError(
              'Failed to update metric',
              'UNKNOWN_ERROR',
              error
            );
          }

          set(state => ({
            error: storeError,
            // Revert optimistic update
            dailyScores: state.dailyScores.filter(
              score => 
                score.metric_type !== update.type || 
                score.date !== currentDate
            ),
          }));
        }
      },

      syncDailyMetrics: (userId: string, date: string) => 
        debouncedSync(userId, date, set, get),

      retryPendingUpdates: async () => {
        const { pendingUpdates } = get();
        const userId = get().dailyScores[0]?.user_id;
        
        if (!userId || pendingUpdates.size === 0) return;

        for (const [key, update] of pendingUpdates) {
          try {
            await get().updateMetric(userId, update);
          } catch (error) {
            console.error(`Failed to retry update ${key}:`, error);
          }
        }
      },
    }),
    {
      name: 'metrics-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        metrics: state.metrics,
        dailyScores: state.dailyScores,
        lastSynced: state.lastSynced,
        pendingUpdates: Array.from(state.pendingUpdates.entries()),
        window: state.window,
      }),
      onRehydrateStorage: () => (state) => {
        // Convert pendingUpdates back to Map after rehydration
        if (state && Array.isArray(state.pendingUpdates)) {
          state.pendingUpdates = new Map(state.pendingUpdates);
        }
        
        // Retry any pending updates and reload window data
        if (state?.retryPendingUpdates && state?.loadWindowData) {
          const userId = state.dailyScores[0]?.user_id;
          if (userId) {
            state.retryPendingUpdates();
            state.loadWindowData(userId);
          }
        }
      },
    }
  )
);