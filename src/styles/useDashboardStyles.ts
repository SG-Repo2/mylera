import { StyleSheet } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';
import { brandColors } from '@/src/theme/theme';

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingShadowContainer: {
      flex: 1,
      borderRadius: 20,
      margin: 16,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: 'transparent',
    },
    headerContainer: {
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    headerContent: {
      paddingHorizontal: 16,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    logo: {
      height: 36,
      width: 100,
      marginRight: 'auto',
    },
    headerRank: {
      fontWeight: '700',
      letterSpacing: 0.5,
      marginHorizontal: 12,
      fontSize: 18,
    },
    headerPoints: {
      fontWeight: '700',
      letterSpacing: 0.5,
      fontSize: 18,
    },
    statsSection: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    statsCard: {
      borderRadius: 16,
      overflow: 'hidden',
      flex: 1,
      minWidth: 100,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    statsContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      minHeight: 80,
    },
    statsLabel: {
      fontSize: 15,
      marginBottom: 8,
      fontWeight: '600',
      textAlign: 'center',
      color: 'white',
    },
    statsValue: {
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: 'white',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 32,
    },
    loadingText: {
      marginTop: 20,
      textAlign: 'center',
      letterSpacing: 0.25,
    },
    errorDialog: {
      borderRadius: 24,
    },
    errorDialogTitle: {
      textAlign: 'center',
      fontSize: 20,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    errorDialogContent: {
      textAlign: 'center',
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: 0.25,
    },
    errorDialogActions: {
      justifyContent: 'center',
      paddingBottom: 8,
    },
    errorDialogButton: {
      padding: 12,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
    }
  });

export const useDashboardStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
