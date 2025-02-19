import { StyleSheet, Dimensions, Platform } from 'react-native';
import { MD3Theme, useTheme } from 'react-native-paper';
import Color from 'color';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const createStyles = (theme: MD3Theme) => {
  const surfaceColor = Color(theme.colors.surface);
  
  return StyleSheet.create({
    modalContainer: {
      margin: 0,
      justifyContent: 'flex-end',
      height: '100%',
      backgroundColor: 'transparent',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      maxHeight: '85%',
      padding: 0,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: -2,
      },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 24,
      overflow: 'hidden',
    },
    scrollContent: {
      padding: screenWidth > 380 ? 24 : 20,
      backgroundColor: theme.colors.surface,
    },
    closeButton: {
      position: 'absolute',
      right: 12,
      top: 12,
      width: 40,
      height: 40,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 20,
      elevation: 3,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    modalTitle: {
      marginBottom: 8,
      color: theme.colors.onSurface,
      letterSpacing: -0.5,
      fontSize: screenWidth > 380 ? 24 : 20,
    },
    modalValue: {
      letterSpacing: -1,
      fontSize: screenWidth > 380 ? 36 : 32,
      textShadowColor: 'rgba(0, 0, 0, 0.1)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    valueContainer: {
      marginBottom: 24,
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      backgroundColor: theme.colors.surface,
    },
    trendContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceVariant,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    trendText: {
      fontSize: 14,
      marginLeft: 4,
      color: theme.colors.onSurfaceVariant,
    },
    trendUp: {
      color: theme.colors.primary,
      backgroundColor: theme.colors.surface,
    },
    trendDown: {
      color: theme.colors.error,
      backgroundColor: theme.colors.surface,
    },
    chartContainer: {
      alignItems: 'center',
      marginVertical: screenWidth > 380 ? 24 : 16,
      backgroundColor: surfaceColor.lighten(0.05).toString(),
      borderRadius: 24,
      padding: 16,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    chart: {
      marginVertical: 8,
      borderRadius: 24,
      overflow: 'hidden',
      width: '100%',
      backgroundColor: theme.colors.surface,
    },
    additionalInfoContainer: {
      marginTop: screenWidth > 380 ? 24 : 16,
      gap: 16,
      padding: 16,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: surfaceColor.alpha(0.12).toString(),
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
      backgroundColor: theme.colors.surfaceVariant,
    },
    infoLabel: {
      color: theme.colors.onSurfaceVariant,
      fontSize: screenWidth > 380 ? 16 : 14,
    },
    infoValue: {
      color: theme.colors.onSurface,
      fontSize: screenWidth > 380 ? 16 : 14,
      fontWeight: '600',
    },
    calorieCharts: {
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
    },
    chartRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
    },
    healthTipCard: {
      marginBottom: screenWidth > 380 ? 24 : 16,
      marginHorizontal: 0,
      backgroundColor: theme.colors.surfaceVariant,
      borderWidth: 1,
      borderColor: surfaceColor.alpha(0.12).toString(),
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    healthTipContent: {
      padding: 16,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceVariant,
    },
    healthTipGlow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.primary,
      opacity: 0.06,
    },
    healthTipHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
      backgroundColor: theme.colors.surfaceVariant,
    },
    healthTipTitle: {
      fontWeight: '600',
      letterSpacing: 0.15,
    },
    healthTipText: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 20,
      letterSpacing: 0.25,
      fontSize: screenWidth > 380 ? 16 : 14,
    },
    loadingContainer: {
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
      backgroundColor: theme.colors.surface,
    },
    loadingText: {
      marginTop: 12,
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
    },
    progressContainer: {
      marginTop: 8,
      gap: 12,
      backgroundColor: theme.colors.surfaceVariant,
    },
    progressBarContainer: {
      height: 8,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 4,
      overflow: 'hidden',
      width: '100%',
    },
  });
};

export const useStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
