import { StyleSheet, Dimensions } from 'react-native';
import { MD3Theme, useTheme } from 'react-native-paper';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const createStyles = (theme: MD3Theme) => StyleSheet.create({
  modalContainer: {
    margin: 0,
    justifyContent: 'flex-end',
    height: '100%',
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
    marginBottom: 24,
    letterSpacing: -1,
    fontSize: screenWidth > 380 ? 36 : 32,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: screenWidth > 380 ? 24 : 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 24,
    overflow: 'hidden',
    width: '100%',
  },
  additionalInfoContainer: {
    marginTop: screenWidth > 380 ? 24 : 16,
    gap: 16,
    padding: 16,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    color: theme.colors.onSurfaceVariant,
    fontSize: screenWidth > 380 ? 16 : 14,
  },
  infoValue: {
    color: theme.colors.onSurface,
    fontSize: screenWidth > 380 ? 16 : 14,
  },
  calorieCharts: {
    marginBottom: 16,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  healthTipCard: {
    marginBottom: screenWidth > 380 ? 24 : 16,
    marginHorizontal: 0,
    backgroundColor: theme.colors.surfaceVariant,
  },
  healthTipContent: {
    padding: 16,
  },
  healthTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
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
});

export const useStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
