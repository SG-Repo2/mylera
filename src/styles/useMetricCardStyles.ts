import { StyleSheet, Dimensions } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const createStyles = (theme: MD3Theme) => {
  // Calculate responsive values based on screen width
  const cardPadding = Math.max(12, Math.min(16, SCREEN_WIDTH * 0.03));
  const iconSize = Math.max(32, Math.min(40, SCREEN_WIDTH * 0.08));
  const titleSize = Math.max(13, Math.min(15, SCREEN_WIDTH * 0.03));
  const valueSize = Math.max(24, Math.min(28, SCREEN_WIDTH * 0.06));
  const unitSize = Math.max(12, Math.min(14, SCREEN_WIDTH * 0.025));
  const progressHeight = Math.max(4, Math.min(6, SCREEN_WIDTH * 0.01));
  const progressRadius = Math.max(2, Math.min(3, SCREEN_WIDTH * 0.005));
  const infoTextSize = Math.max(10, Math.min(12, SCREEN_WIDTH * 0.025));
  
  return StyleSheet.create({
    cardWrapper: {
      minHeight: Math.max(140, Math.min(160, SCREEN_WIDTH * 0.35)),
      aspectRatio: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: Math.max(16, Math.min(20, SCREEN_WIDTH * 0.04)),
      overflow: 'hidden',
    },
    cardShadowWrapper: {
      borderRadius: Math.max(16, Math.min(20, SCREEN_WIDTH * 0.04)),
      height: '100%',
      backgroundColor: theme.colors.surface,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      overflow: 'hidden',
    },
    cardContentWrapper: {
      borderRadius: Math.max(16, Math.min(20, SCREEN_WIDTH * 0.04)),
      overflow: 'hidden',
      height: '100%',
      backgroundColor: 'transparent',
    },
    detailCardShadow: {
      borderRadius: Math.max(16, Math.min(20, SCREEN_WIDTH * 0.04)),
      marginHorizontal: Math.max(12, Math.min(16, SCREEN_WIDTH * 0.03)),
      marginVertical: Math.max(6, Math.min(8, SCREEN_WIDTH * 0.015)),
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
      borderRadius: Math.max(16, Math.min(20, SCREEN_WIDTH * 0.04)),
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },
    ripple: {
      borderRadius: Math.max(16, Math.min(20, SCREEN_WIDTH * 0.04)),
      height: '100%',
    },
    cardContent: {
      padding: cardPadding,
      gap: Math.max(8, Math.min(10, SCREEN_WIDTH * 0.02)),
      height: '100%',
      justifyContent: 'space-between',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Math.max(6, Math.min(10, SCREEN_WIDTH * 0.02)),
    },
    iconContainer: {
      width: iconSize,
      height: iconSize,
      borderRadius: Math.max(8, Math.min(12, SCREEN_WIDTH * 0.02)),
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
      fontSize: titleSize,
      fontWeight: '600',
    },
    valueContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: Math.max(4, Math.min(6, SCREEN_WIDTH * 0.01)),
    },
    value: {
      fontWeight: '700',
      fontSize: valueSize,
    },
    unit: {
      fontWeight: '600',
      fontSize: unitSize,
      opacity: 0.8,
    },
    progressContainer: {
      gap: Math.max(4, Math.min(6, SCREEN_WIDTH * 0.01)),
      width: '100%',
    },
    progressBarContainer: {
      height: progressHeight,
      borderRadius: progressRadius,
      overflow: 'hidden',
      width: '100%',
    },
    progressBarBackground: {
      position: 'absolute',
      height: '100%',
      width: '100%',
      borderRadius: progressRadius,
      backgroundColor: 'rgba(0,0,0,0.05)', // Default background
    },
    progressBarFill: {
      height: '100%',
      borderRadius: progressRadius,
    },
    progressBarHighlight: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '40%',
      backgroundColor: 'rgba(255,255,255,0.25)', // Subtle highlight
      borderTopLeftRadius: progressRadius,
      borderTopRightRadius: progressRadius,
    },
    progressInfo: {
      flexDirection: 'column',
      gap: Math.max(2, Math.min(4, SCREEN_WIDTH * 0.008)),
      width: '100%',
    },
    progressText: {
      textAlign: 'right',
      fontSize: infoTextSize,
      opacity: 0.7,
    },
    pointsText: {
      textAlign: 'right',
      fontSize: infoTextSize,
      opacity: 0.7,
      fontWeight: '500',
    }
  });
};

export const useMetricCardStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};