import { StyleSheet, Dimensions, useWindowDimensions } from 'react-native';
import { useTheme, MD3Theme } from 'react-native-paper';
import { brandColors } from '@/src/theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper function for responsive cards
const getOptimalCardSize = (screenWidth: number) => {
  // Calculate base spacing values
  const baseMargin = Math.max(12, Math.min(16, screenWidth * 0.03));
  const baseGap = Math.max(8, Math.min(12, screenWidth * 0.02));
  
  // Calculate available width after margins
  const availableWidth = screenWidth - (baseMargin * 2);
  
  // For smaller screens (iPhone SE, etc.)
  if (screenWidth < 360) {
    return {
      width: (availableWidth - baseGap) / 2,
      minWidth: Math.max(120, Math.min(140, screenWidth * 0.35)),
      maxWidth: Math.max(140, Math.min(160, screenWidth * 0.45)),
      gap: baseGap,
      margin: baseMargin,
    };
  }
  
  // For medium screens (most phones)
  if (screenWidth < 600) {
    return {
      width: '48%', // Using percentage for flexibility
      minWidth: Math.max(130, Math.min(150, screenWidth * 0.35)),
      maxWidth: Math.max(150, Math.min(180, screenWidth * 0.45)),
      gap: baseGap,
      margin: baseMargin,
    };
  }
  
  // For larger screens/tablets
  return {
    width: (availableWidth - baseGap * 2) / 3, // 3 cards per row
    minWidth: Math.max(140, Math.min(160, screenWidth * 0.25)),
    maxWidth: Math.max(160, Math.min(200, screenWidth * 0.3)),
    gap: baseGap,
    margin: baseMargin,
  };
};

const createStyles = (theme: MD3Theme) => {
  const cardSize = getOptimalCardSize(SCREEN_WIDTH);
  
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: Math.max(4, Math.min(8, SCREEN_WIDTH * 0.015)),
      backgroundColor: theme.colors.background,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: cardSize.gap,
      justifyContent: SCREEN_WIDTH < 600 ? 'space-between' : 'flex-start',
      alignItems: 'flex-start',
      paddingHorizontal: cardSize.margin,
    },
    cell: {
      width: cardSize.width as number,
      minWidth: cardSize.minWidth,
      maxWidth: cardSize.maxWidth,
      marginBottom: Math.max(8, Math.min(12, SCREEN_WIDTH * 0.02)),
    },
    lastCell: {
      width: cardSize.width as number,
      minWidth: cardSize.minWidth,
      maxWidth: cardSize.maxWidth,
      marginBottom: Math.max(12, Math.min(16, SCREEN_WIDTH * 0.03)),
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
