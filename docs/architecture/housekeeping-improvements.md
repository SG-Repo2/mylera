# Housekeeping Improvements

## 1. Dead Code Removal

### Identified Dead Code
- `subscribeToLeaderboard` function in `src/services/leaderboardService.ts` is not used anywhere in the codebase and should be removed
- The function was likely intended for real-time leaderboard updates but is currently unused

### Action Items
- Remove the `subscribeToLeaderboard` function
- Clean up related Supabase channel subscription code
- Consider implementing WebSocket-based updates in the future if real-time updates become necessary

## 2. Permission Handling Simplification

### Current Implementation
- Both Apple and Google health providers maintain separate permission implementations
- No sleep metrics are currently tracked, though references exist in the Google provider
- Permissions are defined statically without TTL implementation

### Recommended Changes
- Simplify to a single permission check on app launch
- Remove unused sleep-related permission references
- Standardize permission handling across platforms:
```typescript
// Common permission interface
export interface HealthPermission {
  accessType: 'read';
  recordType: string;
}
```

## 3. Error Handling Consolidation

### Current Pattern
- Multiple instances of similar error handling code:
  - Permission errors (code: '42501')
  - Foreign key errors (code: 'PGRST200')
  - No rows returned (code: 'PGRST116')

### Recommended Solution
Create a centralized error handling utility:
```typescript
// src/utils/errorHandling.ts
export const handleDatabaseError = (error: any) => {
  switch (error.code) {
    case '42501':
      return { type: 'permission', message: 'Permission denied' };
    case 'PGRST200':
      return { type: 'foreign_key', message: 'Related record not found' };
    case 'PGRST116':
      return { type: 'not_found', message: 'No records found' };
    default:
      return { type: 'unknown', message: error.message };
  }
};
```

## 4. Calories Metric Normalization

### Current Implementation
- iOS: Separate `basal_calories` and `calories` (active) metrics
- Android: Combined calorie tracking
- Different default goals (500 for active, 1800 for basal)

### Recommendation
Standardize to separate tracking:
- Keep `basal_calories` and `calories` as distinct metrics
- Update Android implementation to separate these values
- Maintain current goal structure as it serves different purposes:
  - Active calories goal (500) for daily activity target
  - Basal calories (1800) for metabolic tracking

## 5. Layout Optimization

### Current Structure
- Multiple `_layout.tsx` files with minimal configuration
- Basic `<Slot />` implementations

### Recommendation
- Consolidate layouts where possible
- Remove unnecessary layout files that only contain `<Slot />`
- Consider implementing shared layout features (headers, navigation) at appropriate levels

## 6. Metric Goals System

### Current Implementation
- Hard-coded default goals in `healthMetrics.ts`
- Points calculation capped at 100 in `metricsService.updateMetric`
- Simple linear progress calculation

### Analysis
The current implementation is sufficient for the following reasons:
- Clear, predictable scoring system (0-100 points)
- Simple goal structure that's easy to understand
- Consistent across all metric types

### Recommendation
Maintain the current goal system as:
1. The 100-point cap provides good gamification without complexity
2. Default goals are reasonable for most users
3. The linear calculation is intuitive for users

## Future Considerations

1. **Real-time Updates**
   - If real-time features become necessary, implement using Supabase's Realtime functionality
   - Consider implementing the removed `subscribeToLeaderboard` with proper error handling

2. **User-Defined Goals**
   - If user-customizable goals are needed, implement a new `user_goals` table
   - Modify `metricsService.updateMetric` to check for user-defined goals before falling back to defaults

3. **Sleep Tracking**
   - Define clear sleep metrics and goals before implementation
   - Ensure consistent tracking methodology across platforms
   - Consider sleep quality metrics beyond duration

## Implementation Priority

1. Remove dead code (subscribeToLeaderboard)
2. Consolidate error handling
3. Simplify permission checks
4. Standardize calorie tracking
5. Optimize layouts
6. Document metric goals system

This approach minimizes risk while improving code maintainability and user experience.