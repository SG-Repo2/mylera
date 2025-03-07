import { StyleSheet, Platform, Dimensions } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerWrapper: {
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: theme.roundness * 1.5,
      overflow: 'hidden',
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
      height: 44,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
    },
    logo: {
      height: 24,
      width: 72,
      resizeMode: 'contain',
    },
    statsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primaryContainer,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.roundness * 1.5,
    },
    statText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.25,
    },
    statLabel: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
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
      padding: 24,
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
      marginTop: 16,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '500',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 32,
    },
    errorDialog: {
      borderRadius: theme.roundness * 3,
      backgroundColor: theme.colors.surface,
    },
    errorDialogTitle: {
      textAlign: 'center',
      color: theme.colors.error,
      fontSize: 20,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    errorDialogContent: {
      textAlign: 'center',
      color: theme.colors.onSurface,
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: 0.25,
    },
    errorDialogActions: {
      justifyContent: 'center',
      paddingBottom: 8,
    },
    errorDialogButton: {
      color: theme.colors.primary,
      padding: 12,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    partialDataText: {
      color: theme.colors.error,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 4,
      fontWeight: '500',
    },
  });

export const useDashboardStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
