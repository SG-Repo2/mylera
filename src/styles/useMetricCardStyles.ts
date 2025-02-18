import { StyleSheet } from 'react-native';
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
    detailCardShadow: {
      borderRadius: 20,
      marginHorizontal: 16,
      marginVertical: 8,
      backgroundColor: theme.colors.surface,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    detailCardContent: {
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
    },
    ripple: {
      borderRadius: 24,
      height: '100%',
      backgroundColor: theme.colors.surface,
    },
    cardContent: {
      padding: 16,
      height: '100%',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 4,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 6,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.15,
    },
    valueContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      marginTop: 8,
      marginBottom: 16,
    },
    value: {
      fontWeight: '700',
      fontSize: 32,
      letterSpacing: -0.5,
    },
    unit: {
      fontWeight: '600',
      opacity: 0.7,
      fontSize: 14,
      letterSpacing: 0.25,
    },
    progressContainer: {
      gap: 8,
    },
    progressBar: {
      height: 6,
      backgroundColor: 'rgba(0,0,0,0.04)',
      borderRadius: 3,
    },
    progressInfo: {
      flexDirection: 'column',
      gap: 4,
    },
    progressText: {
      textAlign: 'right',
      fontSize: 13,
      opacity: 0.8,
      letterSpacing: 0.4,
      fontWeight: '500',
    },
    pointsText: {
      textAlign: 'right',
      fontSize: 13,
      opacity: 0.7,
      fontWeight: '500',
      letterSpacing: 0.4,
    }
  });

export const useMetricCardStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
