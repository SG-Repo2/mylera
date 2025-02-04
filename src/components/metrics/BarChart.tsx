import React, { useEffect, useState } from 'react';
import { View, Dimensions, StyleSheet, Animated } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MetricType } from '@/src/types/metrics';
import { metricColors } from '@/src/styles/useMetricCardListStyles';

interface BarChartProps {
  metricType: MetricType;
}

interface DataPoint {
  date: string;
  value: number;
  animation: Animated.Value;
}

export function BarChart({ metricType }: BarChartProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const theme = useTheme();

  const generateMockData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let baseValue: number;
    let variance: number;

    switch (metricType) {
      case 'steps':
        baseValue = 8000;
        variance = 2000;
        break;
      case 'distance':
        baseValue = 3;
        variance = 1;
        break;
      case 'heart_rate':
        baseValue = 70;
        variance = 10;
        break;
      case 'calories':
        baseValue = 400;
        variance = 100;
        break;
      case 'exercise':
        baseValue = 30;
        variance = 15;
        break;
      case 'basal_calories':
        baseValue = 1800;
        variance = 200;
        break;
      case 'flights_climbed':
        baseValue = 10;
        variance = 5;
        break;
      default:
        baseValue = 100;
        variance = 20;
    }

    return days.map(day => ({
      date: day,
      value: baseValue + Math.random() * variance,
      animation: new Animated.Value(0)
    }));
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      try {
        const mockData = generateMockData();
        setData(mockData);
        setLoading(false);

        // Animate bars
        Animated.stagger(100, 
          mockData.map(item =>
            Animated.spring(item.animation, {
              toValue: 1,
              useNativeDriver: false,
              friction: 8,
              tension: 40
            })
          )
        ).start();

      } catch (err) {
        setError('Failed to load chart data');
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [metricType]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          Loading chart data...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.errorContainer }]}>
        <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
          {error}
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const padding = (maxValue - minValue) * 0.1;
  const yMax = maxValue + padding;
  const yMin = Math.max(0, minValue - padding);
  const range = yMax - yMin;

  const chartWidth = Dimensions.get('window').width - 48; // Accounting for padding
  const chartHeight = 220;
  const barWidth = (chartWidth - 40) / data.length - 8; // Account for spacing between bars

  return (
    <View style={styles.container}>
      {/* Y-axis labels */}
      <View style={styles.yAxisLabels}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {Math.ceil(yMax)}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {Math.floor(yMin)}
        </Text>
      </View>

      {/* Chart area */}
      <View style={styles.chartArea}>
        {/* Grid lines */}
        <View style={styles.gridContainer}>
          {[0, 25, 50, 75, 100].map((percent) => (
            <View
              key={percent}
              style={[
                styles.gridLine,
                {
                  top: `${percent}%`,
                  backgroundColor: theme.colors.surfaceVariant
                }
              ]}
            />
          ))}
        </View>

        {/* Bars */}
        <View style={styles.barsContainer}>
          {data.map((point, index) => {
            const barHeight = ((point.value - yMin) / range) * chartHeight;
            
            return (
              <View key={point.date} style={styles.barWrapper}>
                <View style={styles.barLabelContainer}>
                  <Text variant="bodySmall" style={[styles.barValue, { color: theme.colors.onSurface }]}>
                    {Math.round(point.value)}
                  </Text>
                </View>
                <Animated.View
                  style={[
                    styles.bar,
                    {
                      height: point.animation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, barHeight]
                      }),
                      width: barWidth,
                      backgroundColor: metricColors[metricType],
                    }
                  ]}
                />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {point.date}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  yAxisLabels: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 30,
    width: 40,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chartArea: {
    flex: 1,
    marginLeft: 40,
    width: Dimensions.get('window').width - 48,
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
  },
  bar: {
    borderRadius: 4,
    marginBottom: 8,
  },
});
