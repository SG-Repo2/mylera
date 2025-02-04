import { StyleSheet } from 'react-native';
import { MD3Theme, useTheme } from 'react-native-paper';

const createStyles = (theme: MD3Theme) => StyleSheet.create({
  modalContainer: {
    margin: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    padding: 24,
    paddingTop: 32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: theme.colors.surfaceVariant,
  },
  modalTitle: {
    marginBottom: 8,
    color: theme.colors.onSurface,
    letterSpacing: -0.5,
  },
  modalValue: {
    marginBottom: 24,
    letterSpacing: -1,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 24,
    overflow: 'hidden',
  },
  additionalInfoContainer: {
    marginTop: 24,
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
  },
  infoValue: {
    color: theme.colors.onSurface,
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
    marginTop: 24,
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
  },
});

export const useStyles = () => {
  const theme = useTheme();
  return createStyles(theme);
};
