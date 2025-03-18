import { Platform } from 'react-native';
import { theme } from '@/src/theme/theme';

/**
 * Tab navigation utility functions for enhancing animations and transitions
 */

/**
 * Determines the appropriate animation based on the platform and route
 * @param routeName The current route name
 * @returns Animation configuration
 */
export function getTabAnimation(routeName: string) {
  // Default animation
  const defaultAnimation = {
    type: Platform.OS === 'android' ? 'timing' : 'spring', // Use timing for smoother Android transitions
    springDampingRatio: 0.8,
    springMass: 0.8,
    duration: Platform.OS === 'android' ? 200 : 300, // Faster on Android
  };
  
  // You can customize animations based on route if needed
  switch (routeName) {
    case '(home)':
      return Platform.OS === 'ios' ? { type: 'spring', duration: 350 } : defaultAnimation;
    case 'profile':
      return Platform.OS === 'ios' ? { type: 'spring', duration: 400 } : defaultAnimation;
    case 'leaderboard': // Add specific handling for leaderboard
      return Platform.OS === 'android' 
        ? { type: 'timing', duration: 200 } // Simple timing for Android
        : { type: 'spring', duration: 350 };
    default:
      return defaultAnimation;
  }
}

/**
 * Creates platform-specific tab bar styles
 * @returns StyleSheet compatible object for tab bar styling
 */
export function getTabBarStyles() {
  return {
    backgroundColor: theme.colors.surface,
    borderTopColor: 'rgba(0,0,0,0.1)',
    height: Platform.OS === 'android' ? 56 : 60, // Slightly smaller on Android
    paddingBottom: Platform.OS === 'android' ? 6 : 8, // Adjust padding for Android
    paddingTop: Platform.OS === 'android' ? 6 : 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
        // Fix Android specific issues with navigation
        overflow: 'hidden',
      },
    }),
  };
}

/**
 * Enhanced tab press handler with haptic feedback and platform-specific behavior
 * @param onPress Original press handler
 * @returns Enhanced press handler
 */
export function createTabPressHandler(onPress: () => void, routeName?: string) {
  return () => {
    // Add a small delay on Android to prevent double navigation
    if (Platform.OS === 'android') {
      // Slightly delay navigation on Android to prevent race conditions
      setTimeout(onPress, 10);
    } else {
      // Immediate navigation on iOS
      onPress();
    }
  };
}

/**
 * Determine if a route can be considered stable for navigation
 * Helps prevent interrupting ongoing navigations
 */
export function isStableRoute(pathname: string): boolean {
  // Don't consider routes that are still transitioning as stable
  return !pathname.includes('undefined') && pathname !== '';
}
