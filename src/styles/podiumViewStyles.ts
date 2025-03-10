import { StyleSheet, Platform } from 'react-native';
import { theme } from '../theme/theme';

export const podiumViewStyles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 16,
    marginVertical: 20,
    backgroundColor: '#1E3A8A',
    borderRadius: theme.roundness * 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 12,
    paddingBottom: 18,
  },
  podiumItem: {
    flex: 1,
    marginHorizontal: 4,
    minHeight: 120,
    maxHeight: 160,
  },
  podiumEntryWrapper: {
    flex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  firstPlace: {
    transform: [{ translateY: -20 }],
    zIndex: 3,
  },
  secondPlace: {
    transform: [{ translateY: -10 }],
    zIndex: 2,
  },
  thirdPlace: {
    zIndex: 1,
  },
});
