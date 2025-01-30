# Sleep Tracking Implementation

## Status
Proposed

## Context
We need to add sleep tracking functionality to our health metrics system, supporting both Android Health Connect and iOS HealthKit. This requires changes to our metric types, permissions, and UI components.

## Decision
We will implement sleep tracking with the following specifications:

### Android Health Connect Integration
- Record Class: SleepSession
- Permissions:
  - Read: android.permission.health.READ_SLEEP
  - Write: android.permission.health.WRITE_SLEEP

### iOS HealthKit Integration
- Identifier: HKCategoryTypeIdentifierSleepAnalysis
- Access: Read only (write access depends on app's data source)

### Architecture Changes Required

1. Metric Type Updates:
   - Add 'sleep' to MetricTypeEnum
   - Update MetricType type definition
   - Add sleep configuration to healthMetrics.ts

2. Health Provider Changes:
   - Add sleep permissions to Android and iOS providers
   - Implement sleep data fetching logic
   - Add sleep session parsing and normalization

3. UI Component Updates:
   - Update MetricCard to handle sleep duration display
   - Add sleep-specific icons and styling
   - Implement sleep data visualization in MetricChart

4. Data Model Updates:
   - Add sleep metrics to database schema
   - Update scoring system to include sleep metrics
   - Add sleep-specific goal tracking

### Implementation Details

1. Sleep Metric Configuration:
```typescript
sleep: {
  id: 'sleep',
  title: 'Sleep',
  icon: 'sleep',
  defaultGoal: 8 * 60, // 8 hours in minutes
  unit: 'MINUTES',
  color: '#8E44AD', // Purple shade
  displayUnit: 'hrs'
}
```

2. Permission Configuration:
```typescript
// Android
{
  recordType: 'SleepSession',
  accessType: ['read', 'write']
}

// iOS
{
  type: 'HKCategoryTypeIdentifierSleepAnalysis',
  access: ['read']
}
```

## Consequences

### Positive
- Enhanced health tracking capabilities
- More comprehensive user health data
- Better integration with platform health services

### Negative
- Increased complexity in permission handling
- Additional data processing requirements
- More complex UI interactions for sleep data

### Risks
- Platform-specific sleep data format differences
- Potential permission issues across different devices
- Data accuracy dependent on user's sleep tracking habits

## Implementation Plan

1. Core Updates:
   - Update metric type system
   - Add sleep permissions to health providers
   - Implement sleep data fetching

2. UI Updates:
   - Add sleep metric card
   - Implement sleep data visualization
   - Update dashboard layout

3. Testing:
   - Verify permissions on both platforms
   - Test sleep data synchronization
   - Validate UI rendering

## Migration Strategy

1. Database:
   - Add sleep metrics table/columns
   - Update existing queries to handle sleep data

2. API:
   - Add sleep endpoints
   - Update metric aggregation logic

3. Client:
   - Update metric type definitions
   - Add sleep UI components
   - Implement sleep data handling

## References
- [Android Health Connect Documentation](https://developer.android.com/health-connect)
- [Apple HealthKit Documentation](https://developer.apple.com/documentation/healthkit)