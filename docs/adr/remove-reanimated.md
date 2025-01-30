# Remove React Native Reanimated

## Context

React Native Reanimated is currently used minimally in the project, with only one instance in the ErrorView component for a simple fade-in animation. Given this limited usage, we can simplify our dependencies by removing Reanimated and using React Native's built-in Animated API instead.

## Decision

We will remove React Native Reanimated from the project and replace its functionality with React Native's built-in Animated API.

## Implementation Steps

1. Update ErrorView.tsx:
   ```typescript
   // Replace Reanimated imports and usage with React Native's Animated
   import { Animated, View, StyleSheet } from 'react-native';
   
   // Replace Animated.View entering={FadeIn} with:
   const fadeAnim = React.useRef(new Animated.Value(0)).current;
   
   React.useEffect(() => {
     Animated.timing(fadeAnim, {
       toValue: 1,
       duration: 500,
       useNativeDriver: true
     }).start();
   }, []);
   
   // Replace <Animated.View entering={FadeIn.duration(500)}> with:
   <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
   ```

2. Remove Reanimated from babel.config.js:
   ```javascript
   module.exports = function (api) {
     api.cache(true);
     return {
       presets: ['babel-preset-expo'],
       plugins: [], // Remove 'react-native-reanimated/plugin'
     };
   };
   ```

3. Remove the dependency:
   ```bash
   yarn remove react-native-reanimated
   ```

4. Clean up iOS/Android configurations:
   - For iOS: Clean and rebuild the project
   - For Android: Clean and rebuild the project
   ```bash
   cd ios && pod deintegrate && pod install && cd ..
   cd android && ./gradlew clean && cd ..
   ```

## Consequences

### Positive
- Reduced bundle size
- Simplified dependency management
- Using platform-provided animation capabilities
- No need for additional babel configuration

### Negative
- Loss of Reanimated's more advanced animation capabilities (though these weren't being used)
- Need to rewrite existing animation code (minimal impact as only one component uses it)

## Status
Proposed

## References
- [React Native Animated API Documentation](https://reactnative.dev/docs/animated)
- [Current ErrorView Implementation](src/components/shared/ErrorView.tsx)