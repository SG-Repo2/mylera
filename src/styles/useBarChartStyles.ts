import { StyleSheet } from 'react-native';
import { brandColors } from '@/src/theme/theme';

const useBarChartStyles = () => {
  return StyleSheet.create({
    barContainer: {
      borderRadius: 4,
      elevation: 2,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    barLabelContainer: {
      marginBottom: 4,
    },
    barValue: {
      fontSize: 10,
      fontWeight: '600',
    },
    barWrapper: {
      alignItems: 'center',
      height: '100%',
      justifyContent: 'flex-end',
    },
    barsContainer: {
      alignItems: 'flex-end',
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 20,
      paddingHorizontal: 8,
    },
    chartArea: {
      flex: 1,
      marginLeft: 40,
      width: '100%', // Take full width after margin
      backgroundColor: '#FFFFFF',
    },
    container: {
      alignItems: 'center',
      borderRadius: 16,
      elevation: 3,
      height: 280,
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    dayLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    gridContainer: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    gridLine: {
      height: 1,
      left: 0,
      position: 'absolute',
      right: 0,
    },
    yAxisLabels: {
      alignItems: 'flex-start',
      bottom: 30,
      justifyContent: 'space-between',
      left: 0,
      paddingLeft: 8,
      position: 'absolute',
      top: 10,
      width: 40,
    },
  });
};

export default useBarChartStyles;
