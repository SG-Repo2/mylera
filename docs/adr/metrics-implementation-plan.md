# Metrics System Implementation Plan

## Phase 1: Core Infrastructure (Week 1)

### 1. Repository Layer Implementation

```typescript
// src/repositories/metrics/types.ts
interface MetricsRepository {
  getDailyMetrics(userId: string, date: string): Promise<DailyMetricScore[]>;
  updateMetric(userId: string, update: MetricUpdate): Promise<void>;
  getMetricGoals(userId: string): Promise<MetricGoals>;
}

// src/repositories/metrics/supabase/SupabaseMetricsRepository.ts
class SupabaseMetricsRepository implements MetricsRepository {
  private static POINTS_MAX = 1000; // Matches DB constraint
  
  constructor(
    private client: SupabaseClient,
    private cache: MetricsCache,
    private validator: MetricsValidator
  ) {}
  
  async getDailyMetrics(userId: string, date: string): Promise<DailyMetricScore[]> {
    // Leverage DB indexes with proper query structure
    const { data, error } = await this.client
      .from('daily_metric_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('metric_type', { ascending: true });
      
    if (error) throw this.handleDatabaseError(error);
    return this.validator.validateDailyMetrics(data);
  }
}
```

### 2. Error Handling System

```typescript
// src/errors/MetricsError.ts
export class MetricsError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public context: ErrorContext,
    public timestamp: number = Date.now()
  ) {
    super(message);
    this.name = 'MetricsError';
  }

  static fromDatabaseError(error: any): MetricsError {
    if (error.code === '23514') { // Check constraint violation
      return new MetricsError(
        'Invalid metric value',
        'VALIDATION_ERROR',
        { constraint: error.constraint_name }
      );
    }
    // Add other database error mappings
    return new MetricsError(
      'Database error',
      'DATABASE_ERROR',
      { original: error }
    );
  }
}
```

## Phase 2: State Management (Week 2)

### 1. Store Implementation

```typescript
// src/stores/metrics/types.ts
interface MetricsState {
  metrics: Record<string, DailyMetricScore[]>;
  loading: Record<string, boolean>;
  error: MetricsError | null;
  window: MetricsWindow;
}

// src/stores/metrics/store.ts
const createMetricsStore = (repository: MetricsRepository) => 
  create<MetricsState & MetricsActions>((set, get) => ({
    metrics: {},
    loading: {},
    error: null,
    window: defaultWindow(),
    
    actions: {
      async fetchMetrics(userId: string, date: string) {
        set(state => ({
          loading: { ...state.loading, [date]: true }
        }));
        
        try {
          const metrics = await repository.getDailyMetrics(userId, date);
          set(state => ({
            metrics: { ...state.metrics, [date]: metrics },
            loading: { ...state.loading, [date]: false }
          }));
        } catch (error) {
          set(state => ({
            error: MetricsError.fromError(error),
            loading: { ...state.loading, [date]: false }
          }));
        }
      }
    }
  }));
```

## Phase 3: Cache Optimization (Week 2)

### 1. Enhanced Caching Strategy

```typescript
// src/cache/metrics/MetricsCache.ts
class MetricsCache {
  private static readonly PREFIX = 'metrics:v1:';
  private static readonly TTL = 60 * 60 * 1000; // 1 hour
  
  constructor(private storage: AsyncStorage) {}
  
  private getKey(userId: string, date: string): string {
    return `${MetricsCache.PREFIX}${userId}:${date}`;
  }
  
  async get(userId: string, date: string): Promise<DailyMetricScore[] | null> {
    const key = this.getKey(userId, date);
    const cached = await this.storage.getItem(key);
    
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > MetricsCache.TTL) {
      await this.storage.removeItem(key);
      return null;
    }
    
    return data;
  }
}
```

## Phase 4: UI Integration (Week 3)

### 1. React Hooks

```typescript
// src/hooks/useMetrics.ts
function useMetrics(userId: string, date: string) {
  const store = useMetricsStore();
  const metrics = store.metrics[date];
  const loading = store.loading[date];
  
  useEffect(() => {
    if (!metrics && !loading) {
      store.actions.fetchMetrics(userId, date);
    }
  }, [userId, date, metrics, loading]);

  return {
    metrics,
    loading,
    error: store.error,
    refresh: () => store.actions.fetchMetrics(userId, date)
  };
}
```

### 2. Error Boundaries

```typescript
// src/components/metrics/MetricsErrorBoundary.tsx
class MetricsErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return {
      error: error instanceof MetricsError ? error : MetricsError.fromError(error)
    };
  }
  
  render() {
    if (this.state.error) {
      return <MetricsErrorView error={this.state.error} onRetry={this.retry} />;
    }
    return this.props.children;
  }
}
```

## Testing Strategy

1. **Unit Tests**
   - Repository methods
   - Error handling
   - Cache operations
   - Store actions

2. **Integration Tests**
   - Repository with real database
   - Cache with AsyncStorage
   - Store with repository

3. **E2E Tests**
   - Complete metrics flow
   - Error scenarios
   - Offline behavior

## Migration Strategy

1. **Preparation**
   - Create new repository implementation
   - Set up error handling
   - Implement new cache

2. **Gradual Rollout**
   - Migrate one component at a time
   - Run old and new implementations in parallel
   - Monitor errors and performance

3. **Cleanup**
   - Remove old implementation
   - Clean up deprecated code
   - Update documentation

## Success Metrics

1. **Performance**
   - Cache hit rate > 80%
   - Average load time < 200ms
   - Memory usage reduction

2. **Reliability**
   - Error rate < 1%
   - Successful retry rate > 95%
   - Zero data loss incidents

3. **Developer Experience**
   - Reduced bug reports
   - Faster feature development
   - Improved code coverage