import { StyleSheet, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';

const useBarChartStyles = () => {
  const theme = useTheme();

  return StyleSheet.create({
    container: {
      height: 280,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
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
    },
    chartArea: {
      flex: 1,
      marginLeft: 40,
      width: Dimensions.get('window').width - 48,
      backgroundColor: '#FFFFFF',
    },
    gridContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    gridLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
    },
    barsContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingBottom: 20,
      paddingHorizontal: 8,
    },
    barWrapper: {
      alignItems: 'center',
      justifyContent: 'flex-end',
      height: '100%',
    },
    barLabelContainer: {
      marginBottom: 4,
    },
    barValue: {
      fontSize: 10,
      fontWeight: '600',
    },
    barContainer: {
      marginBottom: 8,
      borderRadius: 4,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    dayLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    tickContainer: {
      position: 'absolute',
      left: 0,
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 8,
      transform: [{ translateY: -8 }]
    }
  });
};

export default useBarChartStyles;