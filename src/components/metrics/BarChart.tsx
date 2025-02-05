import React, { useEffect, useState } from 'react';
import { View, Dimensions, StyleSheet, Animated } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MetricType } from '@/src/types/metrics';
import { metricColors } from '@/src/styles/useMetricCardListStyles';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import type { NormalizedMetric } from '@/src/providers/health/types/metrics';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Color from 'color';

interface BarChartProps {
  metricType: MetricType;
  userId: string;
  date: string;
  provider: HealthProvider;
}

interface DataPoint {
  date: string;
  value: number;
  animation: Animated.Value;
  dayName: string;
}

export function BarChart({ metricType, userId, date, provider }: BarChartProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const theme = useTheme();

  const getDayName = (dateStr: string): string => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[new Date(dateStr).getDay()];
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        console.log('Fetching health data for:', { userId, metricType, date });
        
        await provider.initialize();

        const endDateTime = new Date(date);
        const startDateTime = new Date(date);
        startDateTime.setDate(startDateTime.getDate() - 6);

        const rawData = await provider.fetchRawMetrics(
          startDateTime,
          endDateTime,
          [metricType]
        );

        if (!mounted) return;

        const normalizedData = provider.normalizeMetrics(rawData, metricType);
        console.log('Normalized health data:', normalizedData);

        const dailyData = new Map<string, number[]>();
        normalizedData.forEach(metric => {
          const day = new Date(metric.timestamp).toLocaleDateString('en-CA');
          if (!dailyData.has(day)) {
            dailyData.set(day, []);
          }
          dailyData.get(day)?.push(metric.value);
        });

        console.log('Daily data map:', Object.fromEntries(dailyData));

        const filledData = [];
        for (let d = new Date(startDateTime); d <= endDateTime; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toLocaleDateString('en-CA');
          const values = dailyData.get(dateStr) || [0];
          const dayTotal = values.reduce((sum, val) => sum + val, 0);
          
          filledData.push({
            date: dateStr,
            value: dayTotal,
            dayName: getDayName(dateStr),
            animation: new Animated.Value(0)
          });
          console.log(`${getDayName(dateStr)} (${dateStr}): ${dayTotal}`);
        }

        setData(filledData);
        setLoading(false);

        Animated.stagger(100, 
          filledData.map(item =>
            Animated.spring(item.animation, {
              toValue: 1,
              useNativeDriver: false,
              friction: 8,
              tension: 40
            })
          )
        ).start();

      } catch (err) {
        if (!mounted) return;
        console.error('Error fetching health data:', err);
        setError('Failed to load health data');
        setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [metricType, userId, date, provider]);

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

  if (data.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          No data available
        </Text>
      </View>
    );
  }

  const validData = data.map(d => ({
    ...d,
    value: typeof d.value === 'number' && !isNaN(d.value) ? d.value : 0
  }));

  const maxValue = Math.max(...validData.map(d => d.value));
  const minValue = Math.min(...validData.map(d => d.value));
  const padding = Math.max((maxValue - minValue) * 0.1, 1);
  const yMax = maxValue + padding;
  const yMin = Math.max(0, minValue - padding);
  const range = Math.max(yMax - yMin, 1);

  const chartWidth = Math.max(Dimensions.get('window').width - 48, 100);
  const chartHeight = 220;
  const barWidth = Math.max((chartWidth - 40) / data.length - 8, 20);

  const baseColor = Color(metricColors[metricType]);
  const gradientStart = baseColor.lighten(0.2).toString();
  const gradientEnd = baseColor.darken(0.1).toString();

  return (
    <View style={styles.container}>
      <View style={styles.yAxisLabels}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {Math.ceil(yMax)}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {Math.floor(yMin)}
        </Text>
      </View>

      <View style={styles.chartArea}>
        <View style={styles.gridContainer}>
          {[0, 25, 50, 75, 100].map((percent) => (
            <View
              key={percent}
              style={[
                styles.gridLine,
                {
                  top: `${percent}%`,
                  backgroundColor: theme.colors.surfaceVariant,
                  opacity: percent === 0 ? 0.8 : 0.2
                }
              ]}
            />
          ))}
        </View>

        <View style={styles.barsContainer}>
          {validData.map((point, index) => {
            const normalizedValue = (point.value - yMin) / range;
            const barHeight = Math.max(
              Math.min(normalizedValue * chartHeight, chartHeight),
              0
            );
            
            const isToday = point.date === date;
            const gradientId = `gradient-${index}`;
            
            return (
              <View key={point.date} style={styles.barWrapper}>
                <View style={styles.barLabelContainer}>
                  <Text variant="bodySmall" style={[styles.barValue, { 
                    color: theme.colors.onSurface,
                    opacity: isToday ? 1 : 0.7
                  }]}>
                    {Math.round(point.value)}
                  </Text>
                </View>
                <Animated.View style={[styles.barContainer, {
                  height: point.animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max(barHeight, 1)]
                  }),
                  width: barWidth,
                }]}>
                  <Svg height="100%" width="100%">
                    <Defs>
                      <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={gradientStart} stopOpacity={isToday ? "1" : "0.9"} />
                        <Stop offset="1" stopColor={gradientEnd} stopOpacity={isToday ? "1" : "0.7"} />
                      </LinearGradient>
                    </Defs>
                    <Rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      rx={4}
                      ry={4}
                      fill={`url(#${gradientId})`}
                    />
                  </Svg>
                </Animated.View>
                <Text variant="bodySmall" style={[
                  styles.dayLabel,
                  { color: theme.colors.onSurfaceVariant },
                  isToday && { 
                    fontWeight: '600', 
                    color: theme.colors.onSurface 
                  }
                ]}>
                  {point.dayName}
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
  barContainer: {
    marginBottom: 8,
    overflow: 'hidden',
  },
  dayLabel: {
    fontSize: 12,
  },
});
