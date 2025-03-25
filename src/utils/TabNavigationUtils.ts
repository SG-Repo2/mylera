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
    type: 'spring',
    springDampingRatio: 0.8,
    springMass: 0.8,
    duration: 300,
  };

  // You can customize animations based on route if needed
  switch (routeName) {
    case '(home)':
      return Platform.OS === 'ios' ? { type: 'spring', duration: 350 } : defaultAnimation;
    case 'profile':
      return Platform.OS === 'ios' ? { type: 'spring', duration: 400 } : defaultAnimation;
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
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  };
}

/**
 * Enhanced tab press handler with haptic feedback
 * @param onPress Original press handler
 * @returns Enhanced press handler
 */
export function createTabPressHandler(onPress: () => void) {
  return () => {
    // You can add haptic feedback here if you import a haptics library
    // For example: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Call original handler
    onPress();
  };
}
