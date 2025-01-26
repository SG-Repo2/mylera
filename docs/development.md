# Development Guide

## Setup & Installation

### Prerequisites
- Node.js (v18 or later)
- Yarn package manager

- Supabase account
- iOS Simulator (for Mac) andr Android Emulator

### Environment Setup
1. Clone the repository
2. Create `.env` file with Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development Workflow
1. Install dependencies: `yarn install`
2. Start development server: `yarn expo start`
3. Press 'i' for iOS or 'a' for Android

## Code Organization

### Feature-First Structure
- Each feature (auth, metrics, leaderboard) is self-contained
- Features include their own components, hooks, and screens
- Shared logic goes in `src/services`

### Component Guidelines
1. Use TypeScript for all components
2. Implement proper prop types
3. Use NativeWind for styling
4. Keep components focused and single-responsibility

Example component structure:
```typescript
interface Props {
  // Clear prop definitions
}

export function MyComponent({ prop1, prop2 }: Props) {
  // Implementation
}
```

### State Management
- Use React Context for global state (auth)
- Local state for component-specific data
- Supabase for persistence

## API Integration

### Supabase Services

#### Authentication
```typescript
// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});

// Logout
const { error } = await supabase.auth.signOut();
```

#### Metrics
```typescript
// Update metric
const { error } = await supabase
  .from('daily_metric_scores')
  .upsert({
    user_id,
    date,
    metric_type,
    points
  });
```

#### Leaderboard
```typescript
// Fetch leaderboard
const { data, error } = await supabase
  .from('daily_totals')
  .select(`
    user_id,
    total_points,
    user_profiles (
      display_name,
      avatar_url
    )
  `)
  .eq('date', today)
  .order('total_points', { ascending: false });
```

## Testing

### Unit Tests
- Test components in isolation
- Mock Supabase calls
- Verify state updates

### Integration Tests
- Test feature workflows
- Verify data persistence
- Check navigation flows

### E2E Tests
- Test complete user journeys
- Verify app behavior in production-like environment

## Error Handling

### API Errors
```typescript
try {
  const { data, error } = await supabaseCall();
  if (error) throw error;
  // Handle success
} catch (error) {
  // Handle error appropriately
}
```

### UI Error Boundaries
```typescript
class ErrorBoundary extends React.Component {
  // Implement error boundary logic
}
```

## Performance Optimization

### React Native Best Practices
1. Use `useCallback` for function props
2. Implement `useMemo` for expensive calculations
3. Optimize list rendering with proper keys
4. Use image caching

### Data Loading Patterns
1. Implement loading states
2. Show placeholders during data fetch
3. Cache responses when appropriate
4. Handle offline scenarios

## Deployment

### Expo Build
1. Configure app.json
2. Run `expo build:ios` or `expo build:android`
3. Submit to respective app stores

### Version Management
- Use semantic versioning
- Maintain changelog
- Document breaking changes

## Monitoring & Analytics

### Error Tracking
- Implement error logging
- Track API failures
- Monitor performance metrics

### Usage Analytics
- Track user engagement
- Monitor feature usage
- Analyze performance metrics

## Security Guidelines

### Data Protection
1. Never store sensitive data in plain text
2. Use secure storage for tokens
3. Implement proper session management
4. Follow platform security best practices

### Code Security
1. Regular dependency updates
2. Code review requirements
3. Security scanning in CI/CD
4. Protected branches

## Contribution Guidelines

### Pull Request Process
1. Create feature branch
2. Follow code style guide
3. Include tests
4. Update documentation
5. Request review

### Code Review Checklist
- [ ] Follows style guide
- [ ] Includes tests
- [ ] Documentation updated
- [ ] No security concerns
- [ ] Performance considered
- [ ] Error handling implemented

## Troubleshooting

### Common Issues
1. Supabase connection issues
2. Build errors
3. Navigation problems
4. State management bugs



### Documentation
- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [Supabase Documentation](https://supabase.io/docs)
- [NativeWind Documentation](https://www.nativewind.dev)

