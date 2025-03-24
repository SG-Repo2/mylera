import { StyleSheet, Platform, Dimensions, useWindowDimensions } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const createStyles = (theme: MD3Theme) => {
  // Calculate responsive values based on screen width
  const headerHeight = Math.max(44, Math.min(56, SCREEN_WIDTH * 0.12));
  const headerMargin = Math.max(8, Math.min(16, SCREEN_WIDTH * 0.02));
  const headerPadding = Math.max(12, Math.min(16, SCREEN_WIDTH * 0.03));
  const logoHeight = Math.max(24, Math.min(32, SCREEN_WIDTH * 0.06));
  const logoWidth = Math.max(72, Math.min(96, SCREEN_WIDTH * 0.18));
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerWrapper: {
      marginHorizontal: Math.max(12, Math.min(16, SCREEN_WIDTH * 0.03)),
      marginTop: headerMargin,
      borderRadius: theme.roundness * 1.5,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.shadow || theme.colors.outline,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    headerContainer: {
      height: headerHeight,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: headerPadding,
    },
    logo: {
      height: logoHeight,
      width: logoWidth,
      resizeMode: 'contain',
    },
    statsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Math.max(4, Math.min(8, SCREEN_WIDTH * 0.015)),
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primaryContainer,
      paddingHorizontal: Math.max(6, Math.min(8, SCREEN_WIDTH * 0.015)),
      paddingVertical: Math.max(2, Math.min(4, SCREEN_WIDTH * 0.008)),
      borderRadius: theme.roundness * 1.5,
    },
    statText: {
      color: theme.colors.primary,
      fontSize: Math.max(12, Math.min(14, SCREEN_WIDTH * 0.03)),
      fontWeight: '600',
      letterSpacing: 0.25,
    },
    statLabel: {
      color: theme.colors.onSurfaceVariant,
      fontSize: Math.max(12, Math.min(14, SCREEN_WIDTH * 0.03)),
      marginRight: 4,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness * 3,
      padding: Math.max(20, Math.min(24, SCREEN_WIDTH * 0.05)),
      width: Math.min(SCREEN_WIDTH * 0.85, 320),
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.shadow || theme.colors.outline,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    loadingText: {
      marginTop: Math.max(12, Math.min(16, SCREEN_WIDTH * 0.03)),
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      fontSize: Math.max(14, Math.min(16, SCREEN_WIDTH * 0.035)),
      fontWeight: '500',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Math.max(12, Math.min(16, SCREEN_WIDTH * 0.03)),
      paddingTop: Math.max(12, Math.min(16, SCREEN_WIDTH * 0.03)),
      paddingBottom: Math.max(24, Math.min(32, SCREEN_WIDTH * 0.06)),
    },
    errorDialog: {
      borderRadius: theme.roundness * 3,
      backgroundColor: theme.colors.surface,
      margin: Math.max(16, Math.min(24, SCREEN_WIDTH * 0.05)),
    },
    errorDialogTitle: {
      textAlign: 'center',
      color: theme.colors.error,
      fontSize: Math.max(18, Math.min(20, SCREEN_WIDTH * 0.045)),
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    errorDialogContent: {
      textAlign: 'center',
      color: theme.colors.onSurface,
      fontSize: Math.max(14, Math.min(16, SCREEN_WIDTH * 0.035)),
      lineHeight: Math.max(20, Math.min(24, SCREEN_WIDTH * 0.05)),
      letterSpacing: 0.25,
    },
    errorDialogActions: {
      justifyContent: 'center',
      paddingBottom: Math.max(4, Math.min(8, SCREEN_WIDTH * 0.015)),
    },
    errorDialogButton: {
      color: theme.colors.primary,
      padding: Math.max(8, Math.min(12, SCREEN_WIDTH * 0.025)),
      fontSize: Math.max(14, Math.min(16, SCREEN_WIDTH * 0.035)),
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    partialDataText: {
      color: theme.colors.error,
      fontSize: Math.max(10, Math.min(12, SCREEN_WIDTH * 0.025)),
      textAlign: 'center',
      marginTop: 4,
      fontWeight: '500',
    },
  });
};

export const useDashboardStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
