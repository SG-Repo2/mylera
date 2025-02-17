import { StyleSheet } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';
import { brandColors } from '@/src/theme/theme';

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    cell: {
      maxWidth: 200,
      minWidth: 150,
      width: '48%',
    },
    container: {
      backgroundColor: theme.colors.background,
      flex: 1,
      paddingTop: 8,
    },
    grid: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },
    lastCell: {
      marginBottom: 16,
      maxWidth: 200,
      minWidth: 150,
      width: '48%',
    },
  });

// Define metric colors using our theme
export const metricColors = {
  steps: brandColors.primary,
  distance: brandColors.secondary,
  calories: brandColors.accent,
  exercise: brandColors.success,
  heart_rate: '#FF5252',
  basal_calories: '#9C27B0',
  flights_climbed: '#FF9800',
};

export const useMetricCardListStyles = () => {
  const theme = useTheme();
  return {
    styles: createStyles(theme),
    colors: metricColors,
  };
};
