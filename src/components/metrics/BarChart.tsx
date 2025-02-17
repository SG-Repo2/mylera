import React, { useEffect, useState } from 'react';
import { View, Dimensions, StyleSheet, Animated } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MetricType } from '@/src/types/metrics';
import { brandColors } from '@/src/theme/theme';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import Svg, { Rect } from 'react-native-svg';
import healthMetrics from '@/src/config/healthMetrics';
import { metricsService } from '@/src/services/metricsService';

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
        console.log('Fetching health data for:', { userId, metricType });

        // Initialize provider
        await provider.initialize();

        // Get current date and date range
        const endDateTime = new Date();
        const startDateTime = new Date();
        startDateTime.setDate(startDateTime.getDate() - 6);

        const endDateStr = endDateTime.toLocaleDateString('en-CA');
        const startDateStr = startDateTime.toLocaleDateString('en-CA');

        console.log('Date range:', { startDateStr, endDateStr });

        // First try to get stored metrics from our database
        const storedMetrics = await metricsService.getHistoricalMetrics(
          userId,
          metricType,
          endDateStr
        );

        console.log('Stored metrics:', storedMetrics);

        // Then get native health data for the full range
        const rawData = await provider.fetchRawMetrics(startDateTime, endDateTime, [metricType]);

        const normalizedData = provider.normalizeMetrics(rawData, metricType);
        console.log('Native health data:', normalizedData);

        // Create a map of daily totals from native data
        const nativeDataMap = new Map<string, number>();
        normalizedData.forEach(metric => {
          const day = new Date(metric.timestamp).toLocaleDateString('en-CA');
          const currentTotal = nativeDataMap.get(day) || 0;
          nativeDataMap.set(day, currentTotal + metric.value);
        });

        // Create a map of stored metrics for quick lookup
        const storedDataMap = new Map(storedMetrics.map(metric => [metric.date, metric.value]));

        // Fill data starting from current day going back 6 days
        const filledData = [];
        for (let i = 0; i >= -6; i--) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const dateStr = d.toLocaleDateString('en-CA');

          // Prefer stored metric, fall back to native data
          let value = storedDataMap.get(dateStr);
          if (value === undefined) {
            value = nativeDataMap.get(dateStr) || 0;
            // Store the native data for future use
            if (value > 0) {
              try {
                await metricsService.updateMetric(userId, metricType, value);
              } catch (err) {
                console.warn('Failed to store metric:', err);
              }
            }
          }

          filledData.push({
            date: dateStr,
            value,
            dayName: getDayName(dateStr),
            animation: new Animated.Value(0),
          });
          console.log(`${getDayName(dateStr)} (${dateStr}): ${value}`);
        }

        // Reverse the array so most recent day is on the right
        filledData.reverse();

        setData(filledData);
        setLoading(false);

        // Enhanced staggered animation sequence
        const animations = filledData.map((item, index) =>
          Animated.sequence([
            Animated.delay(index * 60),
            Animated.spring(item.animation, {
              toValue: 1,
              useNativeDriver: false,
              stiffness: 180,
              damping: 12,
              mass: 0.8,
            }),
          ])
        );

        Animated.stagger(40, animations).start();
      } catch (err) {
        if (!mounted) return;
        console.error('Error fetching health data:', err);
        setError('Failed to load health data');
        setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [metricType, userId, date, provider]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
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
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
          No data available
        </Text>
      </View>
    );
  }

  const validData = data.map(d => ({
    ...d,
    value: typeof d.value === 'number' && !isNaN(d.value) ? d.value : 0,
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

  const metricColor = healthMetrics[metricType].color;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.yAxisLabels}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
          {Math.ceil(yMax)}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
          {Math.floor(yMin)}
        </Text>
      </View>

      <View style={styles.chartArea}>
        <View style={styles.gridContainer}>
          {[0, 25, 50, 75, 100].map(percent => (
            <View
              key={percent}
              style={[
                styles.gridLine,
                {
                  top: `${percent}%`,
                  backgroundColor: brandColors.primary,
                  opacity: percent === 0 ? 0.15 : 0.05,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.barsContainer}>
          {validData.map((point, index) => {
            const normalizedValue = (point.value - yMin) / range;
            const barHeight = Math.max(Math.min(normalizedValue * chartHeight, chartHeight), 0);

            const isToday = point.date === new Date().toLocaleDateString('en-CA');
            return (
              <View key={point.date} style={styles.barWrapper}>
                <View style={styles.barLabelContainer}>
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.barValue,
                      {
                        color: theme.colors.onSurface,
                        opacity: isToday ? 1 : 0.9,
                      },
                    ]}
                  >
                    {Math.round(point.value)}
                  </Text>
                </View>
                <Animated.View
                  style={[
                    styles.barContainer,
                    {
                      height: point.animation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, Math.max(barHeight, 1)],
                      }),
                      width: barWidth,
                      backgroundColor: metricColor + '1A', // 10% opacity version for container
                      transform: [
                        {
                          scaleY: point.animation.interpolate({
                            inputRange: [0, 0.8, 0.9, 1],
                            outputRange: [0.3, 1.05, 1.02, 1],
                          }),
                        },
                      ],
                      transformOrigin: 'bottom',
                    },
                  ]}
                >
                  <Svg height="100%" width="100%">
                    <Rect x="0" y="0" width="100%" height="100%" rx={4} ry={4} fill={metricColor} />
                  </Svg>
                </Animated.View>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.dayLabel,
                    { color: theme.colors.onSurface },
                    isToday && {
                      fontWeight: '600',
                      opacity: 1,
                    },
                    !isToday && {
                      opacity: 0.7,
                    },
                  ]}
                >
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
    backgroundColor: '#FFFFFF',
    flex: 1,
    marginLeft: 40,
    width: Dimensions.get('window').width - 48,
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
