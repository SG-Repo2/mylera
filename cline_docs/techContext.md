# Technical Context

## Technology Stack
- React Native (Mobile Framework)
- TypeScript (Programming Language)
- Jest (Testing Framework)
- React Testing Library (Component Testing)

## Development Setup
- Node.js environment
- Platform-specific SDKs (iOS/Android)
- Jest for testing
- ESLint for code quality
- Prettier for code formatting

## Technical Constraints

1. Platform-Specific Health APIs
   - iOS: Apple HealthKit
   - Android: Google Health Connect
   - Different permission models per platform
   - Platform-specific initialization requirements
   - Varying error handling needs

2. Testing Constraints
   - Mock implementations required for platform APIs
   - Async operations handling in tests
   - Platform-specific behavior testing
   - Test timeouts for async operations (3000ms default)
   - Mock data type validation requirements
   - Error simulation needs

3. Type Safety Requirements
   - Strong TypeScript typing
   - Interface contracts for providers
   - Type validation for health metrics
   - Error type definitions
   - Platform-specific type guards

4. Error Handling Requirements
   - Granular error propagation
   - Platform-specific error mapping
   - User-friendly error messages
   - Recovery mechanisms
   - Error state management

## Dependencies
- @testing-library/react-native
- jest-circus
- @babel/runtime
- Platform-specific health SDKs

## Development Practices
- Test-Driven Development
- Strong typing with TypeScript
- Platform-specific code isolation
- Comprehensive error handling
- Clean code principles

## Testing Best Practices
1. Mock Provider Setup
   - Complete interface implementation
   - Error simulation capabilities
   - Platform-specific behavior mocking

2. Async Testing
   - Proper timeout configuration
   - waitFor with error messages
   - Loading state verification
   - Error state handling

3. Error Handling
   - Error message verification
   - Error state propagation
   - Recovery mechanism testing
   - Platform-specific error cases

4. Type Safety
   - Mock data type validation
   - Interface compliance checking
   - Error type verification
   - Platform-specific type guards
