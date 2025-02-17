import { StyleSheet } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    cardContent: {
      gap: 10,
      height: '100%',
      justifyContent: 'space-between',
      padding: 14,
    },
    cardContentWrapper: {
      backgroundColor: 'transparent',
      borderRadius: 20,
      height: '100%',
      overflow: 'hidden',
    },
    cardShadowWrapper: {
      borderRadius: 20,
      elevation: 3,
      height: '100%',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    cardWrapper: {
      aspectRatio: 1,
      minHeight: 160,
    },
    detailCardContent: {
      backgroundColor: 'transparent',
      borderRadius: 20,
      overflow: 'hidden',
    },
    detailCardShadow: {
      borderRadius: 20,
      elevation: 3,
      marginHorizontal: 16,
      marginVertical: 8,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    headerRow: {
      alignItems: 'center',
      flexDirection: 'row',
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
    pointsText: {
      fontSize: 12,
      fontWeight: '500',
      opacity: 0.7,
      textAlign: 'right',
    },
    progressBar: {
      backgroundColor: 'rgba(0,0,0,0.05)',
      borderRadius: 3,
      height: 6,
    },
    progressContainer: {
      gap: 6,
    },
    progressInfo: {
      flexDirection: 'column',
      gap: 4,
    },
    progressText: {
      fontSize: 12,
      opacity: 0.7,
      textAlign: 'right',
    },
    ripple: {
      borderRadius: 20,
      height: '100%',
    },
    title: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
    },
    unit: {
      fontWeight: '600',
      opacity: 0.8,
    },
    value: {
      fontSize: 28,
      fontWeight: '700',
    },
    valueContainer: {
      alignItems: 'baseline',
      flexDirection: 'row',
      gap: 6,
    },
  });

export const useMetricCardStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
