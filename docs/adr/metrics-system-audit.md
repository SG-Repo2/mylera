# Metrics System Architectural Audit

## Current State Analysis

### 1. State Management (metricsStore.ts)
- **Issues:**
  - Monolithic store handling multiple concerns
  - Direct API calls mixed with state updates
  - Duplicate retry logic with service layer
  - Complex error handling scattered throughout
  - No clear separation between data and presentation layers

### 2. Service Layer (metricsService.ts)
- **Issues:**
  - Duplicate validation logic
  - Mixed responsibilities (data fetching, scoring, updates)
  - Tight coupling with Supabase implementation
  - Inconsistent error handling patterns

### 3. Caching (MetricsCache.ts)
- **Strengths:**
  - Well-implemented LRU/FIFO strategies
  - Proper cache invalidation
- **Issues:**
  - Tight coupling with store updates
  - No clear separation from data layer
  - Limited error recovery strategies

### 4. Metrics Calculation (useMetricsCalculation.ts)
- **Issues:**
  - Business logic mixed with presentation layer
  - Limited reusability outside React components
  - Tight coupling with specific metric types

## Proposed Architecture

### 1. Data Layer

```typescript
interface MetricsDataProvider {
  fetchDailyMetrics(userId: string, date: string): Promise<DailyMetricScore[]>;
  updateMetric(userId: string, update: MetricUpdate): Promise<void>;
  batchUpdateMetrics(updates: MetricUpdate[]): Promise<void>;
}

class MetricsRepository {
  constructor(
    private dataProvider: MetricsDataProvider,
    private cache: MetricsCache
  ) {}
  
  async getMetrics(userId: string): Promise<MetricsData> {
    return this.cache.get(userId) ?? await this.dataProvider.fetchDailyMetrics(userId);
  }
}
```

### 2. Error Handling

```typescript
class MetricsError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public context: ErrorContext,
    public timestamp: number = Date.now()
  ) {
    super(message);
  }
}

const errorHandler = {
  network: (error: NetworkError) => new MetricsError(error.message, 'NETWORK_ERROR', {retryable: true}),
  validation: (error: ValidationError) => new MetricsError(error.message, 'VALIDATION_ERROR', {field: error.field}),
  storage: (error: StorageError) => new MetricsError(error.message, 'STORAGE_ERROR', {persistent: true})
};
```

### 3. Business Logic Layer

```typescript
class MetricsCalculator {
  calculatePoints(value: number, goal: number): number {
    const progress = Math.min((value / goal) * 100, 100);
    return Math.floor(progress);
  }

  calculateBonusPoints(value: number, goal: number): number {
    if (value <= goal) return 0;
    return Math.floor((value - goal) / goal * 20);
  }

  getTotalScore(metrics: MetricsData): number {
    return Object.values(metrics)
      .filter(isValidMetric)
      .reduce((total, metric) => total + this.calculatePoints(metric.value, metric.goal), 0);
  }
}
```

### 4. State Management

```typescript
interface MetricsState {
  data: MetricsData | null;
  loading: boolean;
  error: MetricsError | null;
}

const createMetricsStore = (repository: MetricsRepository) => 
  create<MetricsState>((set) => ({
    data: null,
    loading: false,
    error: null,
    
    fetch: async (userId: string) => {
      set({ loading: true });
      try {
        const data = await repository.getMetrics(userId);
        set({ data, loading: false });
      } catch (error) {
        set({ error: errorHandler.handle(error), loading: false });
      }
    }
  }));
```

## Implementation Plan

1. **Phase 1: Core Infrastructure**
   - Implement MetricsRepository
   - Create unified error handling system
   - Refactor MetricsCache for better separation

2. **Phase 2: Business Logic**
   - Extract calculation logic to MetricsCalculator
   - Implement proper validation layer
   - Create type-safe metric definitions

3. **Phase 3: State Management**
   - Refactor store to use repository pattern
   - Implement proper error boundaries
   - Add retry strategies

4. **Phase 4: UI Layer**
   - Update components to use new architecture
   - Implement proper loading states
   - Add error recovery UI

## Benefits

1. **Improved Maintainability**
   - Clear separation of concerns
   - Easier testing and debugging
   - Better error handling

2. **Better Performance**
   - Optimized caching
   - Reduced unnecessary updates
   - Better error recovery

3. **Enhanced Reliability**
   - Proper error handling
   - Consistent retry strategies
   - Better offline support

4. **Better Developer Experience**
   - Clear data flow
   - Type-safe operations
   - Better tooling support