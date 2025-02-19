import { StyleSheet, Platform } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      height: 280,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
    },
    yAxisLabels: {
      position: 'absolute',
      left: 0,
      top: 10,
      bottom: 30,
      width: 40,
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingLeft: 8,
      backgroundColor: theme.colors.surface,
    },
    chartArea: {
      flex: 1,
      marginLeft: 40,
      width: '100%',
      backgroundColor: theme.colors.surface,
    },
    gridContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.surface,
    },
    gridLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: theme.colors.surfaceVariant,
      opacity: 0.1,
    },
    barsContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingBottom: 20,
      paddingHorizontal: 8,
      backgroundColor: theme.colors.surface,
    },
    barWrapper: {
      alignItems: 'center',
      justifyContent: 'flex-end',
      height: '100%',
      backgroundColor: theme.colors.surface,
    },
    barLabelContainer: {
      marginBottom: 4,
      backgroundColor: theme.colors.surface,
    },
    barValue: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    barContainer: {
      marginBottom: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    dayLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    todayLabel: {
      color: theme.colors.onSurface,
      fontWeight: '600',
    },
    noDataContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
    },
    noDataText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 16,
      fontWeight: '500',
    },
    errorContainer: {
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      height: 200,
    },
    errorText: {
      color: theme.colors.error,
      textAlign: 'center',
    },
  });

export const useBarChartStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
