import { StyleSheet } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    cardWrapper: {
      minHeight: 160,
      aspectRatio: 1,
    },
    cardShadowWrapper: {
      borderRadius: 20,
      height: '100%',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardContentWrapper: {
      borderRadius: 20,
      overflow: 'hidden',
      height: '100%',
      backgroundColor: 'transparent',
    },
    detailCardShadow: {
      borderRadius: 20,
      marginHorizontal: 16,
      marginVertical: 8,
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
      backgroundColor: 'transparent',
    },
    ripple: {
      borderRadius: 20,
      height: '100%',
    },
    cardContent: {
      padding: 14,
      gap: 10,
      height: '100%',
      justifyContent: 'space-between',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent', // Color is passed as prop
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 4,
    },
    title: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
    },
    valueContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    value: {
      fontWeight: '700',
      fontSize: 28,
    },
    unit: {
      fontWeight: '600',
      opacity: 0.8,
    },
    progressContainer: {
      gap: 6,
    },
    progressBar: {
      height: 6,
      backgroundColor: 'rgba(0,0,0,0.05)',
      borderRadius: 3,
    },
    progressInfo: {
      flexDirection: 'column',
      gap: 4,
    },
    progressText: {
      textAlign: 'right',
      fontSize: 12,
      opacity: 0.7,
    },
    pointsText: {
      textAlign: 'right',
      fontSize: 12,
      opacity: 0.7,
      fontWeight: '500',
    }
  });

export const useMetricCardStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
