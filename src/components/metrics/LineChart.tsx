import React, { useEffect, useState } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Line, Rect, Text as SvgText, G } from 'react-native-svg';
import { MetricType } from '@/src/types/metrics';
import { metricColors } from '@/src/styles/useMetricCardListStyles';

interface LineChartProps {
  metricType: MetricType;
}

interface DataPoint {
  date: string;
  value: number;
}

export function LineChart({ metricType }: LineChartProps) {
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
      value: baseValue + Math.random() * variance
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

  const chartWidth = Dimensions.get('window').width - 48; // Accounting for padding
  const chartHeight = 220;
  const barWidth = (chartWidth * 0.8) / data.length;

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
        <Svg width={chartWidth} height={chartHeight}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent) => (
            <Line
              key={percent}
              x1="0"
              y1={`${percent}%`}
              x2="100%"
              y2={`${percent}%`}
              stroke={theme.colors.surfaceVariant}
              strokeWidth="1"
            />
          ))}

          {/* Bars */}
          {data.map((d, i) => {
            const x = (i * chartWidth) / (data.length - 1);
            const y = ((yMax - d.value) / (yMax - yMin)) * chartHeight;
            const barHeight = chartHeight - y;
            
            return (
              <G key={i}>
                <Rect
                  x={x - barWidth/2}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={metricColors[metricType]}
                  opacity={0.9}
                  rx={2}
                />
                <SvgText
                  x={x}
                  y={y - 10}
                  textAnchor="middle"
                  fill={theme.colors.onSurface}
                  fontSize={12}
                >
                  {Math.round(d.value)}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {/* X-axis labels */}
        <View style={styles.xAxisLabels}>
          {data.map((d) => (
            <Text
              key={d.date}
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {d.date}
            </Text>
          ))}
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
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
  },
});
