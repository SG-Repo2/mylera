# MyLera Health Tracking Implementation Guide

## Overview

This guide outlines modular, context-aware implementation steps to improve provider setup, error handling, and data transaction management in the MyLera Health Tracking application.

### Key Issues Identified

1. **Provider Cleanup Flow**
   - Cleanup operations work but may run concurrently with initialization
   - Potential race conditions need addressing

2. **Provider Initialization Errors**
   - "Cannot initialize provider without userId" error indicates improper userId setup
   - Need for better initialization sequence

3. **Permission Management Flow**
   - Inconsistencies in permission state transitions
   - Impact on provider reliability

4. **Data Transaction Integrity**
   - Need for atomic updates via Supabase RPC
   - Transaction consistency requirements

## Expected System Behavior

### 1. Robust Provider Initialization
- Validate userId presence before initialization
- Synchronize provider cleanup and initialization states
- Implement retry logic with exponential backoff

### 2. Atomic Data Synchronization
- Centralize metric configurations (METRIC_SOURCES)
- Use Supabase RPC for atomic updates
- Implement transaction rollback on failure

### 3. Reliable Pull-to-Refresh
- Synchronize native data before UI updates
- Update leaderboard and daily totals atomically
- Provide smooth UI transitions

### 4. UI Components and Testing
- Integrate MetricCard, MetricCardList, and MetricCardModal
- Ensure smooth animations and interactions
- Implement comprehensive test coverage

## Implementation Steps

### 1. Enhanced Provider Initialization and State Management

#### A. Validate UserID and Synchronized Cleanup

```typescript
interface ProviderInitOptions {
  userId: string;
  platform: 'apple' | 'google' | 'fitbit';
  timeout?: number;
}

class ProviderInitializationManager {
  private initLock: AsyncLock = new AsyncLock();
  private currentInit: Promise<void> | null = null;

  async initializeProvider(options: ProviderInitOptions): Promise<HealthProvider> {
    return this.initLock.acquire('init', async () => {
      if (!options.userId) {
        throw new Error('userId is required for provider initialization');
      }
      await this.cleanupExisting();
      const provider = await HealthProviderFactory.createProvider(options.platform);
      await provider.setUserId(options.userId);
      await this.initializeWithRetry(provider, {
        maxRetries: 3,
        timeout: options.timeout
      });
      return provider;
    });
  }
}
```

### 2. Enhanced Data Transaction and Synchronization

#### A. Metric Source Configuration

```typescript
const METRIC_SOURCES: Record<MetricType, MetricSource> = {
  steps: { source: 'native', lastSynced: null, metricTypes: ['steps'] },
  distance: { source: 'native', lastSynced: null, metricTypes: ['distance'] },
  calories: { source: 'native', lastSynced: null, metricTypes: ['calories'] },
  // ... additional metrics
};
```

#### B. Synchronization Implementation

```typescript
async function synchronizeMetrics(
  nativeMetrics: HealthMetrics,
  userId: string
): Promise<void> {
  try {
    const { data: existingMetrics, error } = await supabase
      .from('daily_metric_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('date', nativeMetrics.date);

    // ... transaction logic
  } catch (syncError) {
    console.error("[synchronizeMetrics] Synchronization failed:", syncError);
    throw syncError;
  }
}
```

### 3. Dashboard Pull-to-Refresh Implementation

```typescript
const handleRefresh = useCallback(async () => {
  if (refreshInProgress.current) return;
  refreshInProgress.current = true;
  setRefreshing(true);
  
  try {
    await syncHealthData();
    const [totals, rank] = await Promise.all([
      metricsService.getDailyTotals(date),
      leaderboardService.getUserRank(userId, date)
    ]);
    
    setDailyTotal(totals);
    setUserRank(rank);
  } catch (error) {
    console.error("[Dashboard] Refresh error:", error);
    setErrorDialogVisible(true);
  } finally {
    refreshInProgress.current = false;
    setRefreshing(false);
  }
}, [syncHealthData, date, userId]);
```

## Testing and Integration

### Component Testing
- MetricCard: Value calculation, animations, memoization
- MetricCardList: Rendering order, animations
- MetricCardModal: Data fetching, error handling

### Unit Tests
- Metric calculations
- Provider initialization
- Transaction handling

### Integration Tests
- Pull-to-refresh flow
- Provider lifecycle
- Error propagation

## Next Steps

1. **Implement Metric Source Consolidation**
   - Create MetricSource interface
   - Implement METRIC_SOURCES

2. **Enhance Data Synchronization**
   - Add synchronizeMetrics function
   - Update unifiedMetricsService

3. **Refine Pull-to-Refresh**
   - Update handleRefresh implementation
   - Add error handling

4. **Validate Provider Logic**
   - Implement ProviderInitializationManager
   - Test userId validation

5. **Run Tests**
   - Unit tests
   - Integration tests
   - Manual testing on iOS/Android

## Conclusion

This implementation plan provides a robust foundation for:
- Reliable provider initialization
- Atomic database updates
- Smooth UI interactions
- Comprehensive test coverage

Future updates should maintain these patterns while extending functionality.