# Authentication Flow Improvements

## Context

The current authentication flow has several issues:
1. Improper handling of database permission errors (42501)
2. Incorrect routing after login/register
3. Incomplete health permission integration
4. Broken sign-out functionality

## Decision

We will implement the following improvements:

### 1. Enhanced Error Handling in AuthProvider

The AuthProvider should distinguish between different types of errors:
- Auth errors (login/register failures)
- Database permission errors (42501)
- Health provider errors

```typescript
// Example error handling structure
if (error.message.includes('42501')) {
  // Handle database permission error
  setError('You do not have permission to access this resource');
} else if (error instanceof HealthProviderError) {
  // Handle health provider error
  setError('Unable to access health data');
} else {
  // Handle general auth error
  setError(error.message);
}
```

### 2. Improved Authentication Flow

The authentication flow should follow this sequence:

1. User authenticates (login/register)
2. Check if user needs health setup:
   - New users -> Route to health setup
   - Existing users -> Check health permissions
3. Based on health permission status:
   - If granted -> Route to main app
   - If denied -> Show permission error
   - If not determined -> Route to health setup

```typescript
// Example routing logic
if (isNewUser) {
  router.replace('/(onboarding)/health-setup');
} else if (healthPermissionStatus === 'granted') {
  router.replace('/(app)/(home)');
} else {
  router.replace('/(onboarding)/health-setup');
}
```

### 3. Enhanced Health Permission Management

Improve health permission handling:
- Cache permission status
- Handle permission changes
- Provide clear user feedback
- Support permission re-request

### 4. Robust Sign-out Process

The sign-out process should:
1. Clear auth state
2. Reset health provider state
3. Clear cached permissions
4. Route to login screen

## Implementation Steps

1. Update AuthProvider:
   - Add error type discrimination
   - Enhance session management
   - Improve health permission handling

2. Modify Login/Register screens:
   - Update routing logic
   - Add proper error handling
   - Improve user feedback

3. Enhance Health Setup:
   - Add permission status persistence
   - Improve error handling
   - Add retry mechanisms

4. Update Protected Routes:
   - Add health permission checks
   - Implement proper redirects
   - Handle permission errors

## Consequences

### Positive
- More reliable authentication flow
- Better error handling and user feedback
- Clearer separation of concerns
- More robust health data integration

### Negative
- Slightly more complex routing logic
- Additional state management needed
- More error cases to handle

## Technical Notes

Key files to modify:
- src/providers/AuthProvider.tsx
- app/(auth)/login.tsx
- app/(auth)/register.tsx
- app/(onboarding)/health-setup.tsx
- app/_layout.tsx (for protected routes)

Database permissions to verify:
- user_profiles table access
- health_data table access
- leaderboard view access

## Status

Proposed

## References

- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Health Platform Integration Guidelines](https://developer.apple.com/documentation/healthkit)