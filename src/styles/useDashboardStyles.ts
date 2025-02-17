import { StyleSheet, Platform } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';
import { brandColors } from '@/src/theme/theme';

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    errorDialog: {
      borderRadius: 24,
    },
    errorDialogActions: {
      justifyContent: 'center',
      paddingBottom: 8,
    },
    errorDialogButton: {
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
      padding: 12,
    },
    errorDialogContent: {
      fontSize: 16,
      letterSpacing: 0.25,
      lineHeight: 24,
      textAlign: 'center',
    },
    errorDialogTitle: {
      fontSize: 20,
      fontWeight: '600',
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    headerContainer: {
      backgroundColor: theme.colors.surface,
      height: 44,
      justifyContent: 'center',
    },
    headerContent: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
    },
    headerWrapper: {
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 8,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    loadingCard: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      maxWidth: 320,
      padding: 24,
      width: '85%',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    loadingContainer: {
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      flex: 1,
      justifyContent: 'center',
    },
    loadingText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 16,
      fontWeight: '500',
      marginTop: 16,
      textAlign: 'center',
    },
    logo: {
      height: 24,
      resizeMode: 'contain',
      width: 72,
    },
    scrollContent: {
      paddingBottom: 32,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    scrollView: {
      flex: 1,
    },
    statItem: {
      alignItems: 'center',
      backgroundColor: theme.colors.primaryContainer,
      borderRadius: 12,
      flexDirection: 'row',
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    statLabel: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      marginRight: 4,
    },
    statText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.25,
    },
    statsContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
  });

export const useDashboardStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
