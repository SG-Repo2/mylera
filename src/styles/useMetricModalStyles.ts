import { StyleSheet, Dimensions, Platform } from 'react-native';
import { MD3Theme, useTheme } from 'react-native-paper';
import Color from 'color';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const createStyles = (theme: MD3Theme) => {
  const surfaceColor = Color(theme.colors.surface);

  return StyleSheet.create({
    additionalInfoContainer: {
      backgroundColor: theme.colors.surfaceVariant,
      borderColor: surfaceColor.alpha(0.12).toString(),
      borderRadius: 24,
      borderWidth: 1,
      gap: 16,
      marginTop: screenWidth > 380 ? 24 : 16,
      padding: 16,
    },
    calorieCharts: {
      marginBottom: 16,
    },
    chart: {
      borderRadius: 24,
      marginVertical: 8,
      overflow: 'hidden',
      width: '100%',
    },
    chartContainer: {
      alignItems: 'center',
      backgroundColor: surfaceColor.lighten(0.05).toString(),
      borderRadius: 24,
      marginVertical: screenWidth > 380 ? 24 : 16,
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
    chartRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    closeButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 20,
      elevation: 3,
      height: 40,
      justifyContent: 'center',
      position: 'absolute',
      right: 12,
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      top: 12,
      width: 40,
      zIndex: 2,
    },
    healthTipCard: {
      backgroundColor: theme.colors.surfaceVariant,
      borderColor: surfaceColor.alpha(0.12).toString(),
      borderWidth: 1,
      marginBottom: screenWidth > 380 ? 24 : 16,
      marginHorizontal: 0,
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
      borderRadius: 12,
      overflow: 'hidden',
      padding: 16,
    },
    healthTipGlow: {
      backgroundColor: theme.colors.primary,
      bottom: 0,
      left: 0,
      opacity: 0.06,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    healthTipHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    healthTipText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: screenWidth > 380 ? 16 : 14,
      letterSpacing: 0.25,
      lineHeight: 20,
    },
    healthTipTitle: {
      fontWeight: '600',
      letterSpacing: 0.15,
    },
    infoLabel: {
      color: theme.colors.onSurfaceVariant,
      fontSize: screenWidth > 380 ? 16 : 14,
    },
    infoRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    infoValue: {
      color: theme.colors.onSurface,
      fontSize: screenWidth > 380 ? 16 : 14,
      fontWeight: '600',
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
      padding: 20,
    },
    loadingText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
      marginTop: 12,
    },
    modalBackdrop: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      flex: 1,
    },
    modalContainer: {
      height: '100%',
      justifyContent: 'flex-end',
      margin: 0,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      elevation: 24,
      maxHeight: '85%',
      overflow: 'hidden',
      padding: 0,
      shadowColor: theme.colors.shadow,
      shadowOffset: {
        width: 0,
        height: -2,
      },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    },
    modalTitle: {
      color: theme.colors.onSurface,
      fontSize: screenWidth > 380 ? 24 : 20,
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    modalValue: {
      fontSize: screenWidth > 380 ? 36 : 32,
      letterSpacing: -1,
      textShadowColor: 'rgba(0, 0, 0, 0.1)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    scrollContent: {
      padding: screenWidth > 380 ? 24 : 20,
    },
    trendContainer: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 16,
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 6,
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
    trendDown: {
      color: theme.colors.error,
    },
    trendText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
      marginLeft: 4,
    },
    trendUp: {
      color: theme.colors.primary,
    },
    valueContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },
  });
};

export const useStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
