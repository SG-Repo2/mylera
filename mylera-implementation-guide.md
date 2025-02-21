# MyLera Health Tracking - Implementation Guide

## Context & Overview

MyLera is a cross-platform health tracking application built with React Native (Expo) that integrates with multiple health data providers (Apple HealthKit, Google Health Connect, Fitbit) and uses Supabase for data persistence and real-time updates. The application faces challenges in maintaining data consistency across these providers while ensuring reliable scoring calculations and leaderboard updates.

### Current Architecture

The application uses a three-layer architecture:
1. Native Health Providers (AppleHealthProvider, GoogleHealthProvider, FitbitHealthProvider)
2. Data Synchronization (unifiedMetricsService, metricsService)
3. Presentation (Dashboard, MetricCards, Leaderboard)

### Primary Challenges

1. Race conditions during health provider initialization
2. Inconsistent data synchronization between native providers and Supabase
3. Unreliable pull-to-refresh behavior
4. Potential scoring discrepancies between direct calculations and leaderboard data

## Implementation Modules

### Module 1: Health Provider Optimization

**Objective:** Ensure reliable initialization and permission management across all health providers.

#### Action Items:

1. Enhance Provider Initialization:
```typescript
// In BaseHealthProvider.ts
protected abstract class BaseHealthProvider {
  private initializationPromise: Promise<void> | null = null;
  
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        await withTimeout(
          this.performInitialization(),
          DEFAULT_TIMEOUTS.INITIALIZATION,
          'Provider initialization timed out'
        );
        this.initialized = true;
      } catch (error) {
        this.initialized = false;
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  protected abstract performInitialization(): Promise<void>;
}
```

2. Implement Permission Verification:
```typescript
// In HealthProviderFactory.ts
class HealthProviderFactory {
  private static async verifyProviderAccess(
    provider: HealthProvider, 
    userId: string
  ): Promise<boolean> {
    const permissionState = await provider.checkPermissionsStatus();
    
    if (permissionState.status !== 'granted') {
      const newStatus = await provider.requestPermissions();
      return newStatus === 'granted';
    }
    
    return true;
  }
}
```

### Module 2: Data Synchronization ✅

**Objective:** Create a reliable data flow between native providers and Supabase.

#### Implementation Details:

1. Atomic Updates:
- Implemented transaction-based updates in unifiedMetricsService
- Added proper error handling and rollback
- Verified atomic updates through comprehensive tests
- Added verification of updated metrics

2. Staleness Check:
- Implemented shouldFetchNative function to check data freshness
- Set 5-minute threshold for stale data
- Added tests to verify staleness detection
- Integrated with getMetrics flow

#### Key Features:
- Transaction-based updates prevent partial data states
- Automatic rollback on errors
- Verification of metric updates
- Smart fetching based on data freshness
- Comprehensive error handling

#### Testing:
- Unit tests for all new functionality
- Coverage for error cases and edge conditions
- Verification of transaction behavior
- Staleness check validation

### Module 3: UI Optimization

**Objective:** Improve UI performance and prevent unnecessary re-renders.

#### Action Items:

1. Implement Debounced Refresh:
```typescript
// In Dashboard.tsx
function Dashboard({ provider, userId }: DashboardProps) {
  const debouncedRefresh = useCallback(
    debounce(async () => {
      if (refreshInProgress.current) return;
      
      refreshInProgress.current = true;
      try {
        await syncHealthData();
      } finally {
        refreshInProgress.current = false;
      }
    }, 500),
    [syncHealthData]
  );

  // ... rest of component
}
```

2. Optimize MetricCard Rendering:
```typescript
// In MetricCard.tsx
const MetricCard = React.memo<MetricCardProps>(
  function MetricCard({ metric, onPress }) {
    // ... component implementation
  },
  (prev, next) => {
    return (
      prev.metric.value === next.metric.value &&
      prev.metric.points === next.metric.points &&
      prev.metric.goalReached === next.metric.goalReached
    );
  }
);
```

### Module 4: Leaderboard Integration

**Objective:** Ensure consistent scoring and real-time leaderboard updates.

#### Action Items:

1. Implement Realtime Subscriptions:
```typescript
// In ToggleableLeaderboard.tsx
function ToggleableLeaderboard() {
  useEffect(() => {
    const subscription = leaderboardService
      .subscribeToLeaderboard(date, timeframe, handleUpdate);
      
    return () => {
      subscription.unsubscribe();
    };
  }, [date, timeframe]);
}
```

2. Standardize Scoring:
```typescript
// In scoringUtils.ts
export function calculateMetricPoints(
  type: MetricType,
  value: number,
  config: MetricConfig
): MetricScore {
  if (type === 'heart_rate') {
    return calculateHeartRateScore(value, config);
  }

  const percentageOfGoal = value / config.defaultGoal;
  const basePoints = Math.min(
    Math.floor(percentageOfGoal * config.pointIncrement.maxPoints),
    config.pointIncrement.maxPoints
  );

  return {
    points: basePoints,
    goalReached: value >= config.defaultGoal,
    value,
    goal: config.defaultGoal
  };
}
```

## Testing Requirements

1. Permission Management:
   - Test initialization with permissions granted/denied
   - Verify permission state persistence
   - Check token refresh for Fitbit

2. Data Synchronization:
   - Verify atomic updates
   - Test concurrent update scenarios
   - Validate staleness checks

3. UI Behavior:
   - Test rapid pull-to-refresh actions
   - Verify metric card updates
   - Check leaderboard real-time updates

## Implementation Timeline

1. Provider Optimization
   - Implement timeout-based initialization
   - Enhance permission management
   - Add token refresh monitoring

2. Data Synchronization
   - Implement atomic updates
   - Add staleness checks
   - Enhance error handling

3. UI Optimization
   - Implement debounced refresh
   - Optimize rendering
   - Add loading states

4. Testing & Integration
   - Write integration tests
   - Perform load testing
   - Document edge cases

## Success Metrics

1. Technical Metrics:
   - Zero unhandled promise rejections
   - < 1s average sync time
   - 100% atomic update success rate

2. User Experience Metrics:
   - < 500ms perceived refresh time
   - Zero UI freezes during sync
   - Real-time leaderboard updates
