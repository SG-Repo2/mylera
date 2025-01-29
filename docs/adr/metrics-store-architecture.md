# Metrics Store Architecture Decision Record

## Context

The current metrics system implementation has several architectural challenges:
- Mixed concerns in state management
- Duplicate validation and error handling
- Tight coupling between layers
- Complex data flow patterns

## Decision

We will implement a new architecture that properly separates concerns and leverages our existing type system.

### 1. Core Types and Validation

```typescript
// Base types from schemas.ts
type MetricType = z.infer<typeof MetricTypeEnum>;
type MetricUpdate = z.infer<typeof MetricUpdateSchema>;
type DailyMetricScore = z.infer<typeof DailyMetricScoreSchema>;

// New error hierarchy
interface MetricErrorContext {
  code: string;
  timestamp: number;
  retryable: boolean;
  details?: unknown;
}

class MetricError extends Error {
  constructor(
    message: string,
    public context: MetricErrorContext
  ) {
    super(message);
  }
}
```

### 2. Repository Pattern

```typescript
interface MetricsRepository {
  getDailyMetrics(userId: string, date: string): Promise<DailyMetricScore[]>;
  updateMetric(userId: string, update: MetricUpdate): Promise<void>;
  getMetricGoals(userId: string): Promise<MetricGoals>;
}

class SupabaseMetricsRepository implements MetricsRepository {
  constructor(
    private client: SupabaseClient,
    private cache: MetricsCache,
    private validator: MetricsValidator
  ) {}

  async getDailyMetrics(userId: string, date: string): Promise<DailyMetricScore[]> {
    // Try cache first
    const cached = await this.cache.get(userId, 'daily', date);
    if (cached) return cached;

    // Fetch from Supabase
    const { data, error } = await this.client
      .from('daily_metric_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date);

    if (error) throw new MetricError('Failed to fetch metrics', {
      code: 'FETCH_ERROR',
      timestamp: Date.now(),
      retryable: true,
      details: error
    });

    // Validate and cache
    const validated = this.validator.validateDailyMetrics(data);
    await this.cache.set(userId, 'daily', date, validated);
    
    return validated;
  }
}
```

### 3. Store Implementation

```typescript
interface MetricsState {
  metrics: Record<string, DailyMetricScore[]>;
  loading: boolean;
  error: MetricError | null;
  window: {
    start: string;
    end: string;
  };
}

const createMetricsStore = (repository: MetricsRepository) => 
  create<MetricsState & MetricsActions>((set, get) => ({
    metrics: {},
    loading: false,
    error: null,
    window: {
      start: new Date().toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    },

    actions: {
      async fetchMetrics(userId: string, date: string) {
        set({ loading: true, error: null });
        
        try {
          const metrics = await repository.getDailyMetrics(userId, date);
          set(state => ({
            metrics: {
              ...state.metrics,
              [date]: metrics
            },
            loading: false
          }));
        } catch (error) {
          set({
            error: error instanceof MetricError ? error : new MetricError(
              'Unknown error fetching metrics',
              {
                code: 'UNKNOWN_ERROR',
                timestamp: Date.now(),
                retryable: false,
                details: error
              }
            ),
            loading: false
          });
        }
      }
    }
  }));
```

### 4. Hooks Layer

```typescript
function useMetrics(userId: string, date: string) {
  const store = useMetricsStore();
  const metrics = store.metrics[date];
  
  useEffect(() => {
    if (!metrics && !store.loading && !store.error) {
      store.actions.fetchMetrics(userId, date);
    }
  }, [userId, date, metrics, store.loading, store.error]);

  return {
    metrics,
    loading: store.loading,
    error: store.error,
    refresh: () => store.actions.fetchMetrics(userId, date)
  };
}
```

## Implementation Strategy

1. **Phase 1: Core Infrastructure**
   - Implement MetricsRepository and SupabaseMetricsRepository
   - Set up proper error handling hierarchy
   - Create MetricsValidator service

2. **Phase 2: Store Refactor**
   - Create new store implementation
   - Add proper TypeScript types
   - Implement action creators

3. **Phase 3: Hook Layer**
   - Create new React hooks
   - Add proper loading states
   - Implement error boundaries

4. **Phase 4: Migration**
   - Gradually migrate components to new architecture
   - Add proper tests
   - Document new patterns

## Consequences

### Positive

- Clear separation of concerns
- Type-safe operations
- Better error handling
- Improved testability
- Consistent data flow
- Better performance through proper caching

### Negative

- More boilerplate code
- Initial migration effort
- Learning curve for new patterns

## Status

Proposed

## References

- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [Error Handling Patterns](https://www.typescriptlang.org/docs/handbook/error-handling.html)
- [React Query Patterns](https://react-query.tanstack.com/guides/important-defaults)