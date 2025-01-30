import { MD3LightTheme, configureFonts } from 'react-native-paper';
import { Platform } from 'react-native';
import type { MD3TypescaleKey } from 'react-native-paper/lib/typescript/types';

// First, let's define our brand colors with semantic meaning
const brandColors = {
  primary: '#183E9F',    // Main brand color for primary actions
  secondary: '#F7A072',  // Secondary actions and highlights
  accent: '#A2D5F2',     // Subtle accents and backgrounds
  success: '#C3E8AC',    // Success states and positive feedback
  neutral: '#F5E8C7',    // Neutral backgrounds and non-interactive elements
};

// Create a complete color scheme that follows Material Design 3 principles
const colors = {
  primary: brandColors.primary,
  onPrimary: '#FFFFFF',
  primaryContainer: `${brandColors.primary}1A`, // 10% opacity version for containers
  onPrimaryContainer: brandColors.primary,
  secondary: brandColors.secondary,
  onSecondary: '#FFFFFF',
  secondaryContainer: `${brandColors.secondary}1A`,
  onSecondaryContainer: brandColors.secondary,
  tertiary: brandColors.accent,
  onTertiary: '#000000',
  tertiaryContainer: `${brandColors.accent}1A`,
  onTertiaryContainer: brandColors.accent,
  success: brandColors.success,
  onSuccess: '#000000',
  successContainer: `${brandColors.success}1A`,
  onSuccessContainer: brandColors.success,
  error: '#FF5252',
  errorContainer: '#FFCDD2',
  onError: '#FFFFFF',
  onErrorContainer: '#FF5252',
  background: brandColors.neutral,  // Back to neutral
  onBackground: '#000000',
  surface: '#FFFFFF',
  onSurface: '#000000',
  surfaceVariant: '#FFFFFF',
  onSurfaceVariant: '#000000',
  outline: '#79747E',
  elevation: {
    level0: 'transparent',
    level1: '#F5F5F5',
    level2: '#EEEEEE',
    level3: '#E0E0E0',
    level4: '#BDBDBD',
    level5: '#9E9E9E',
  },
};

// Define a complete type scale using Proxima Nova
const baseFont = {
  fontFamily: Platform.select({
    web: 'Proxima Nova',
    ios: 'Proxima Nova',
    android: 'ProximaNova',
  }) ?? 'Proxima Nova',
};

// Create a comprehensive typescale following Material Design 3 guidelines
const fontConfig = {
  displayLarge: {
    ...baseFont,
    fontSize: 57,
    lineHeight: 64,
    letterSpacing: -0.25,
    fontWeight: '400',
  },
  displayMedium: {
    ...baseFont,
    fontSize: 45,
    lineHeight: 52,
    letterSpacing: 0,
    fontWeight: '400',
  },
  displaySmall: {
    ...baseFont,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: 0,
    fontWeight: '400',
  },
  headlineLarge: {
    ...baseFont,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0,
    fontWeight: '700',
  },
  headlineMedium: {
    ...baseFont,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 0,
    fontWeight: '700',
  },
  headlineSmall: {
    ...baseFont,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0,
    fontWeight: '700',
  },
  titleLarge: {
    ...baseFont,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0,
    fontWeight: '600',
  },
  titleMedium: {
    ...baseFont,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
    fontWeight: '600',
  },
  titleSmall: {
    ...baseFont,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    fontWeight: '600',
  },
  bodyLarge: {
    ...baseFont,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
    fontWeight: '400',
  },
  bodyMedium: {
    ...baseFont,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
    fontWeight: '400',
  },
  bodySmall: {
    ...baseFont,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    fontWeight: '400',
  },
  labelLarge: {
    ...baseFont,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    fontWeight: '500',
  },
  labelMedium: {
    ...baseFont,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  labelSmall: {
    ...baseFont,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
};

// Create our custom theme by extending MD3LightTheme
export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...colors,
  },
  fonts: configureFonts({
    config: {
      ...fontConfig,
      displayLarge: {
        ...fontConfig.displayLarge,
        fontWeight: '700' as const,
      },
      displayMedium: {
        ...fontConfig.displayMedium,
        fontWeight: '600' as const,
      },
      displaySmall: {
        ...fontConfig.displaySmall,
        fontWeight: '600' as const,
      },
      headlineLarge: {
        ...fontConfig.headlineLarge,
        fontWeight: '600' as const,
      },
      headlineMedium: {
        ...fontConfig.headlineMedium,
        fontWeight: '600' as const,
      },
      headlineSmall: {
        ...fontConfig.headlineSmall,
        fontWeight: '600' as const,
      },
      titleLarge: {
        ...fontConfig.titleLarge,
        fontWeight: '600' as const,
      },
      titleMedium: {
        ...fontConfig.titleMedium,
        fontWeight: '600' as const,
      },
      titleSmall: {
        ...fontConfig.titleSmall,
        fontWeight: '600' as const,
      },
      bodyLarge: {
        ...fontConfig.bodyLarge,
        fontWeight: '400' as const,
      },
      bodyMedium: {
        ...fontConfig.bodyMedium,
        fontWeight: '400' as const,
      },
      bodySmall: {
        ...fontConfig.bodySmall,
        fontWeight: '400' as const,
      },
      labelLarge: {
        ...fontConfig.labelLarge,
        fontWeight: '500' as const,
      },
      labelMedium: {
        ...fontConfig.labelMedium,
        fontWeight: '500' as const,
      },
      labelSmall: {
        ...fontConfig.labelSmall,
        fontWeight: '500' as const,
      },
    }
  }),
  roundness: 8,
  animation: {
    scale: 1.0,
  },
};

// Export theme type for TypeScript support
export type AppTheme = typeof theme;