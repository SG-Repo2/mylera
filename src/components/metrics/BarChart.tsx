import React, { useEffect, useState, useMemo } from 'react';
import { View, Dimensions, Animated } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MetricType } from '@/src/types/metrics';
import { brandColors } from '@/src/theme/theme';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import Svg, { Rect, Line } from 'react-native-svg';
import healthMetrics from '@/src/config/healthMetrics';
import { getYAxisConfig, formatTickValue, convertMetricValue } from '../../utils/metricUtils';
import { MeasurementSystem } from '../../types/metrics';
import useBarChartStyles from '../../styles/useBarChartStyles';

interface BarChartProps {
  metricType: MetricType;
  userId: string;
  date: string;
  provider: HealthProvider;
  measurementSystem: MeasurementSystem;
}

interface DataPoint {
  date: string;
  value: number;
  animation: Animated.Value;
  dayName: string;
  isToday: boolean;
  isEmpty: boolean;
}

export const BarChart = React.memo(function BarChart({ metricType, userId, date, provider, measurementSystem }: BarChartProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const theme = useTheme();
  const styles = useBarChartStyles();

  // Move all useMemo hooks to the top level
  const chartWidth = useMemo(() => Math.max(Dimensions.get('window').width - 48, 100), []);
  const chartHeight = useMemo(() => 220, []);
  const barWidth = useMemo(() => Math.max((chartWidth - 40) / 7 - 8, 20), []); // Use fixed value 7 for data points

  // Calculate chart metrics using useMemo
  const chartMetrics = useMemo(() => {
    if (data.length === 0) {
      return {
        validData: [],
        maxValue: 1,
        minValue: 0,
        yMin: 0,
        yMax: 1,
        range: 1
      };
    }

    const validData = data.map(d => ({
      ...d,
      value: typeof d.value === 'number' && !isNaN(d.value) ? d.value : 0
    }));

    const maxValue = Math.max(...validData.map(d => d.value), 1);
    const minValue = Math.min(...validData.map(d => d.value));
    const padding = Math.max((maxValue - minValue) * 0.1, 1);
    const yMax = maxValue + padding;
    const yMin = Math.max(0, minValue - padding);
    const range = Math.max(yMax - yMin, 1);

    return {
      validData,
      maxValue,
      minValue,
      yMin,
      yMax,
      range
    };
  }, [data]);

  // Calculate Y-axis configuration using useMemo
  const yAxisConfig = useMemo(() => 
    getYAxisConfig(metricType, chartMetrics.maxValue, measurementSystem),
    [metricType, chartMetrics.maxValue, measurementSystem]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        console.log('Fetching native health data for:', { userId, metricType });
        
        // Initialize provider
        await provider.initialize();

        // Get current date and date range for the past 7 days
        const endDateTime = new Date();
        const startDateTime = new Date();
        startDateTime.setDate(startDateTime.getDate() - 6);

        const endDateStr = endDateTime.toLocaleDateString('en-CA');
        const startDateStr = startDateTime.toLocaleDateString('en-CA');

        console.log('Date range:', { startDateStr, endDateStr });

        // Get native health data for the full range
        const rawData = await provider.fetchRawMetrics(
          startDateTime,
          endDateTime,
          [metricType]
        );

        const normalizedData = provider.normalizeMetrics(rawData, metricType);
        console.log('Native health data count:', normalizedData.length);

        // Create a map of daily totals from native data
        const nativeDataMap = new Map<string, number>();
        normalizedData.forEach(metric => {
          const day = new Date(metric.timestamp).toLocaleDateString('en-CA');
          const currentTotal = nativeDataMap.get(day) || 0;
          nativeDataMap.set(day, currentTotal + metric.value);
        });

        console.log('Native data by day:', Object.fromEntries(nativeDataMap.entries()));

        // Fill data starting from current day going back 6 days
        const filledData: DataPoint[] = [];
        for (let i = -6; i <= 0; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const dateStr = d.toLocaleDateString('en-CA');
          
          // Get value directly from native data
          const value = nativeDataMap.get(dateStr) || 0;
          
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayName = days[d.getDay()];
          
          const isToday = i === 0;
          const isYesterday = i === -1;
          
          filledData.push({
            date: dateStr,
            value,
            dayName: isToday ? `${dayName}\nToday` : 
                    isYesterday ? `${dayName}\nYest.` : 
                    dayName,
            isToday,
            isEmpty: value === 0,
            animation: new Animated.Value(0)
          });
          console.log(`${dayName} (${dateStr}): ${value}`);
        }

        if (mounted) {
          setData(filledData);
          setLoading(false);

          // Store animation references for cleanup
          const animationSubscriptions = [];
          
          // Enhanced staggered animation sequence
          const animations = filledData.map((item, index) => {
            // Create animation sequence
            const sequence = Animated.sequence([
              Animated.delay(index * 40),
              Animated.spring(item.animation, {
                toValue: 1,
                useNativeDriver: false,
                stiffness: 200,
                damping: 14,
                mass: 0.7,
                restDisplacementThreshold: 0.001,
                restSpeedThreshold: 0.001,
              })
            ]);
            
            return sequence;
          });

          // Start animations and store subscription
          const subscription = Animated.stagger(30, animations).start();
          if (subscription != null) animationSubscriptions.push(subscription);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Error fetching native health data:', err);
        setError('Failed to load health data');
        setLoading(false);
      }
    };

    fetchData();
    
    // Return cleanup function
    return () => { 
      mounted = false;
      
      // Stop all data point animations
      if (data && data.length) {
        data.forEach(point => {
          if (point.animation) {
            point.animation.stopAnimation();
          }
        });
      }
    };
  }, [metricType, userId, date, provider]);

  const renderContent = () => {
    if (loading) {
      return (
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
          Loading chart data...
        </Text>
      );
    }

    if (error) {
      return (
        <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
          {error}
        </Text>
      );
    }

    if (data.length === 0) {
      return (
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
          No data available
        </Text>
      );
    }

    const metricColor = healthMetrics[metricType].color;

    return (
      <>
        <View style={styles.yAxisLabels}>
          {yAxisConfig.tickValues.map((value, index) => (
            <View 
              key={index} 
              style={[
                styles.tickContainer,
                { 
                  top: `${100 - ((value - yAxisConfig.yMin) / (yAxisConfig.yMax - yAxisConfig.yMin) * 100)}%`,
                  zIndex: 5
                }
              ]}
            >
              <Text
                variant="bodySmall"
                style={{ 
                  color: theme.colors.onSurface, 
                  fontWeight: index === 0 || index === yAxisConfig.tickValues.length - 1 ? '600' : '400',
                  fontSize: 10
                }}
              >
                {formatTickValue(value, metricType, measurementSystem)}
              </Text>
              <View 
                style={[
                  styles.gridLine,
                  { 
                    backgroundColor: brandColors.primary,
                    opacity: index === 0 ? 0.15 : 0.05
                  }
                ]} 
              />
            </View>
          ))}
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
                    backgroundColor: brandColors.primary,
                    opacity: percent === 0 ? 0.15 : 0.05
                  }
                ]}
              />
            ))}
          </View>

          <View style={styles.barsContainer}>
            {chartMetrics.validData.map((point, index) => {
              const normalizedValue = (point.value - chartMetrics.yMin) / chartMetrics.range;
              const barHeight = Math.max(
                Math.min(normalizedValue * chartHeight, chartHeight),
                point.isEmpty ? 2 : 4
              );
              
              const color = point.isEmpty 
                ? theme.colors.surfaceDisabled 
                : healthMetrics[metricType].color;
              
              return (
                <View key={point.date} style={styles.barWrapper}>
                  <View style={styles.barLabelContainer}>
                    <Text variant="bodySmall" style={[styles.barValue, { 
                      color: theme.colors.onSurface,
                      opacity: point.isToday ? 1 : 0.9,
                      display: point.isEmpty ? 'none' : 'flex'
                    }]}>
                      {formatTickValue(point.value, metricType, measurementSystem)}
                    </Text>
                  </View>
                  <Animated.View style={[styles.barContainer, {
                    height: point.animation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, barHeight],
                    }),
                    width: barWidth,
                    transform: [{
                      scaleY: point.animation.interpolate({
                        inputRange: [0, 0.7, 0.9, 1],
                        outputRange: [0.3, 1.06, 1.02, 1], // Refined overshoot for natural movement
                      })
                    }],
                    transformOrigin: 'bottom',
                    // Adding subtle shadow for better visual depth
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: point.isEmpty ? 0 : 0.1,
                    shadowRadius: 2,
                  }]}>
                    <View 
                      style={[
                        styles.barOverlay, 
                        {
                          backgroundColor: point.isEmpty 
                            ? theme.colors.surfaceDisabled + '80'
                            : color + '1A',
                        }
                      ]} 
                    />
                    
                    <Svg height="100%" width="100%">
                      <Rect
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        rx={4}
                        ry={4}
                        fill={color}
                      />
                    </Svg>
                  </Animated.View>
                  <Text variant="bodySmall" style={[
                    styles.dayLabel,
                    { color: theme.colors.onSurface },
                    point.isToday && { 
                      fontWeight: '600',
                      opacity: 1
                    },
                    !point.isToday && {
                      opacity: 0.7
                    }
                  ]}>
                    {point.dayName}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </>
    );
  };

  return (
    <View style={[styles.container, { 
      backgroundColor: error 
        ? theme.colors.errorContainer 
        : theme.colors.surface,
      overflow: 'visible' // Explicitly set overflow to avoid shadow clipping
    }]}>
      {renderContent()}
    </View>
  );
});
