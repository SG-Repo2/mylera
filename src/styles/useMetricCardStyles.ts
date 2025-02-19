import { StyleSheet } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    cardWrapper: {
      aspectRatio: 1,
      minHeight: 140,
      maxHeight: 180,
      borderRadius: 20,
    },
    cardSurface: {
      height: '100%',
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
    },
    ripple: {
      height: '100%',
      borderRadius: 20,
    },
    cardContent: {
      padding: 16,
      height: '100%',
      justifyContent: 'space-between',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 4,
    },
    iconContainer: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    icon: {
      textShadowColor: 'rgba(0,0,0,0.1)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    title: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: 0.15,
      color: theme.colors.onSurface,
    },
    valueContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
      marginBottom: 8,
    },
    value: {
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: -0.5,
      color: theme.colors.onSurface,
    },
    unit: {
      fontSize: 13,
      fontWeight: '500',
      letterSpacing: 0.1,
      opacity: 0.7,
      color: theme.colors.onSurfaceVariant,
    },
    progressContainer: {
      gap: 4,
    },
    progressTrack: {
      height: 4,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      borderRadius: 2,
    },
    progressInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressText: {
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0.4,
      color: theme.colors.onSurfaceVariant,
    },
    pointsText: {
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0.4,
      color: theme.colors.onSurfaceVariant,
    },
  });

export const useMetricCardStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};