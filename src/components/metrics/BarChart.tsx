import React, { useEffect, useState } from 'react';
import { View, Dimensions, StyleSheet, Animated, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MetricType } from '@/src/types/metrics';
import { brandColors } from '@/src/theme/theme';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import Svg, { Rect } from 'react-native-svg';
import healthMetrics from '@/src/config/healthMetrics';
import { metricsService } from '@/src/services/metricsService';
import { DateUtils } from '@/src/utils/DateUtils';

interface BarChartProps {
  metricType: MetricType;
  data: Array<{
    date: string;
    value: number;
    dayName: string;
  }>;
  onBarSelect?: (value: number, dateStr: string, dayName: string) => void;
}

export function BarChart({ metricType, data, onBarSelect }: BarChartProps) {
  const theme = useTheme();
  const [animatedData, setAnimatedData] = useState(
    data.map(item => ({
      ...item,
      animation: new Animated.Value(0)
    }))
  );

  useEffect(() => {
    // Enhanced staggered animation sequence
    const animations = animatedData.map((item, index) =>
      Animated.sequence([
        Animated.delay(index * 60),
        Animated.spring(item.animation, {
          toValue: 1,
          useNativeDriver: false,
          stiffness: 180,
          damping: 12,
          mass: 0.8,
        })
      ])
    );

    Animated.stagger(40, animations).start();
  }, []);

  if (data.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
          No data available
        </Text>
      </View>
    );
  }

  const validData = animatedData.map(d => ({
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
          {validData.map((point, index) => {
            const normalizedValue = (point.value - yMin) / range;
            const barHeight = Math.max(
              Math.min(normalizedValue * chartHeight, chartHeight),
              0
            );
            
            const isToday = DateUtils.isToday(point.date);
            return (
              <Pressable 
                key={point.date} 
                style={styles.barWrapper}
                onPress={() => onBarSelect?.(point.value, point.date, point.dayName)}
              >
                <View style={styles.barLabelContainer}>
                  <Text variant="bodySmall" style={[styles.barValue, { 
                    color: theme.colors.onSurface,
                    opacity: isToday ? 1 : 0.9
                  }]}>
                    {Math.round(point.value)}
                  </Text>
                </View>
                <Animated.View style={[styles.barContainer, {
                  height: point.animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max(barHeight, 1)],
                  }),
                  width: barWidth,
                  backgroundColor: metricColor + '1A', // 10% opacity version for container
                  transform: [{
                    scaleY: point.animation.interpolate({
                      inputRange: [0, 0.8, 0.9, 1],
                      outputRange: [0.3, 1.05, 1.02, 1],
                    })
                  }],
                  transformOrigin: 'bottom'
                }]}>
                  <Svg height="100%" width="100%">
                    <Rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      rx={4}
                      ry={4}
                      fill={metricColor}
                    />
                  </Svg>
                </Animated.View>
                <Text variant="bodySmall" style={[
                  styles.dayLabel,
                  { color: theme.colors.onSurface },
                  isToday && { 
                    fontWeight: '600',
                    opacity: 1
                  },
                  !isToday && {
                    opacity: 0.7
                  }
                ]}>
                  {point.dayName}
                </Text>
              </Pressable>
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
  },
  chartArea: {
    flex: 1,
    marginLeft: 40,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 20,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
  },
  barWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  barLabelContainer: {
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
  },
  barContainer: {
    marginBottom: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
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
});
