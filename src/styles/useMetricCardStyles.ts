import { StyleSheet, Platform } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    cardWrapper: {
      minHeight: 160,
      aspectRatio: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
    },
    cardShadowWrapper: {
      borderRadius: 24,
      height: '100%',
      backgroundColor: theme.colors.surface,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    cardContentWrapper: {
      borderRadius: 24,
      overflow: 'hidden',
      height: '100%',
      backgroundColor: theme.colors.surface,
    },
    ripple: {
      borderRadius: 24,
      height: '100%',
      backgroundColor: theme.colors.surface,
    },
    cardContent: {
      padding: 20,
      height: '100%',
      justifyContent: 'flex-start',
      backgroundColor: theme.colors.surface,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 24,
      backgroundColor: theme.colors.surface,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 6,
    },
    icon: {
      textShadowColor: 'rgba(0,0,0,0.1)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    title: {
      flex: 1,
      fontSize: 24,
      fontWeight: '600',
      letterSpacing: -0.5,
      color: '#000',
    },
    valueContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginBottom: 24,
    },
    value: {
      fontWeight: '700',
      fontSize: 48,
      letterSpacing: -1,
      lineHeight: 56,
      color: '#000',
    },
    unit: {
      fontWeight: '500',
      fontSize: 20,
      letterSpacing: 0,
      lineHeight: 24,
      color: '#666',
    },
    progressContainer: {
      gap: 8,
      marginTop: 'auto',
    },
    progressBar: {
      height: 4,
      backgroundColor: 'rgba(0,0,0,0.05)',
      borderRadius: 2,
      marginBottom: 8,
    },
    progressInfo: {
      flexDirection: 'column',
      gap: 4,
    },
    progressText: {
      textAlign: 'right',
      fontSize: 14,
      color: '#666',
      fontWeight: '500',
      letterSpacing: 0,
      lineHeight: 20,
    },
    pointsText: {
      textAlign: 'right',
      fontSize: 14,
      color: '#666',
      fontWeight: '500',
      letterSpacing: 0,
      lineHeight: 20,
    }
  });

export const useMetricCardStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
