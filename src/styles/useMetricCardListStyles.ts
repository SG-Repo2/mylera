import { StyleSheet, Dimensions } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';
import { brandColors } from '@/src/theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper function for responsive cards
const getOptimalCardSize = (screenWidth: number, margin: number = 16, gap: number = 12) => {
  // Calculate available width after margins
  const availableWidth = screenWidth - (margin * 2);
  
  // For smaller screens, use a more compact layout
  if (screenWidth < 360) {
    return {
      width: (availableWidth - gap) / 2,
      minWidth: 140,
      maxWidth: 180,
    };
  }
  
  // For medium screens, standard layout
  if (screenWidth < 600) {
    return {
      width: '48%', // Using percentage for flexibility
      minWidth: 150,
      maxWidth: 200,
    };
  }
  
  // For larger screens/tablets, show more cards in a row
  return {
    width: (availableWidth - gap * 2) / 3, // 3 cards per row
    minWidth: 160,
    maxWidth: 220,
  };
};

const createStyles = (theme: MD3Theme) => {
  const cardSize = getOptimalCardSize(SCREEN_WIDTH);
  
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 8,
      backgroundColor: theme.colors.background,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: SCREEN_WIDTH < 600 ? 'space-between' : 'flex-start',
      alignItems: 'flex-start',
    },
    cell: {
      width: cardSize.width as number,
      minWidth: cardSize.minWidth,
      maxWidth: cardSize.maxWidth,
      marginBottom: 12, // Consistent spacing
    },
    lastCell: {
      width: cardSize.width as number,
      minWidth: cardSize.minWidth,
      maxWidth: cardSize.maxWidth,
      marginBottom: 16,
    }
  });
};

// Define metric colors using our theme
export const metricColors = {
  steps: brandColors.primary,
  distance: brandColors.secondary,
  calories: brandColors.accent,
  exercise: brandColors.success,
  heart_rate: '#FF5252',
  basal_calories: '#9C27B0',
  flights_climbed: '#FF9800'
};

export const useMetricCardListStyles = () => {
  const theme = useTheme();
  return {
    styles: createStyles(theme),
    colors: metricColors
  };
};
