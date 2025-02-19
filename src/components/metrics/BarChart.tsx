import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Dimensions, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MetricType } from '@/src/types/metrics';
import { metricColors } from '@/src/styles/useMetricCardListStyles';
import { useBarChartStyles } from '@/src/styles/useBarChartStyles';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  Easing,
  useSharedValue
} from 'react-native-reanimated';
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

interface BarProps {
  height: number;
  width: number;
  color: string;
  animIndex: number;
  date: string;
  value: number;
  dayName: string;
  onPress: () => void;
  isToday: boolean;
}

// Add error boundary component
const ChartErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (hasError) {
      console.error('[BarChart] Error boundary caught error:', error);
    }
  }, [hasError, error]);

  if (hasError) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
      }}>
        <Text style={{
          fontSize: 16,
          color: '#666',
          textAlign: 'center'
        }}>
          Chart data could not be displayed
        </Text>
      </View>
    );
  }

  return (
    <React.Fragment>
      {children}
    </React.Fragment>
  );
};

// Separate Bar component to handle individual bar animations
const Bar = React.memo(({ 
  height, 
  width, 
  color, 
  animIndex,
  date,
  value,
  dayName,
  onPress,
  isToday
}: BarProps) => {
  const styles = useBarChartStyles();
  const barHeight = useSharedValue(0);
  const scale = useSharedValue(0.3);

  // Add error handling for animation
  const startAnimation = useCallback(() => {
    try {
      barHeight.value = withSpring(1, {
        damping: 12,
        stiffness: 180,
        mass: 0.8
      });
      scale.value = withSpring(1, {
        damping: 12,
        stiffness: 180,
        mass: 0.8
      });
    } catch (error) {
      console.error('[BarChart] Animation error:', error);
    }
  }, [barHeight, scale]);

  useEffect(() => {
    const delay = animIndex * 60;
    const timer = setTimeout(startAnimation, delay);
    return () => clearTimeout(timer);
  }, [animIndex, startAnimation]);

  // Create animated styles at the component level
  const animatedStyles = useAnimatedStyle(() => ({
    height: height * barHeight.value,
    transform: [{ scaleY: scale.value }]
  }));

  return (
    <Pressable 
      style={styles.barWrapper}
      onPress={onPress}
    >
      <View style={styles.barLabelContainer}>
        <Text style={styles.barValue}>
          {Math.round(value)}
        </Text>
      </View>
      <Animated.View style={[
        styles.barContainer,
        {
          width,
          backgroundColor: `${color}15`,
        },
        animatedStyles
      ]}>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            backgroundColor: color,
            borderRadius: 4,
            opacity: 0.9,
          }}
        />
      </Animated.View>
      <Text style={[
        styles.dayLabel,
        isToday && styles.todayLabel
      ]}>
        {dayName}
      </Text>
    </Pressable>
  );
});

export function BarChart({ metricType, data, onBarSelect }: BarChartProps) {
  const styles = useBarChartStyles();
  const metricColor = metricColors[metricType];
  
  const chartDimensions = useMemo(() => {
    const chartWidth = Math.max(Dimensions.get('window').width - 48, 100);
    const chartHeight = 200;
    const barWidth = (chartWidth / data.length) * 0.6;
    
    return { chartWidth, chartHeight, barWidth };
  }, [data.length]);

  // Calculate chart metrics once
  const { validData, yMin, yMax, range } = useMemo(() => {
    const validData = data.map(item => ({
      ...item,
      value: typeof item.value === 'number' && !isNaN(item.value) ? item.value : 0
    }));

    const maxValue = Math.max(...validData.map(d => d.value));
    const minValue = Math.min(...validData.map(d => d.value));
    const padding = Math.max((maxValue - minValue) * 0.1, 1);
    const yMax = maxValue + padding;
    const yMin = Math.max(0, minValue - padding);
    const range = Math.max(yMax - yMin, 1);

    return { validData, yMin, yMax, range };
  }, [data]);

  if (data.length === 0) {
    return (
      <View style={styles.noDataContainer}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  return (
    <ChartErrorBoundary>
      <View style={styles.container}>
        <View style={styles.yAxisLabels}>
          <Text style={styles.barValue}>
            {Math.ceil(yMax)}
          </Text>
          <Text style={styles.barValue}>
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
                  { top: `${percent}%` }
                ]}
              />
            ))}
          </View>

          <View style={styles.barsContainer}>
            {validData.map((point, index) => {
              const normalizedValue = (point.value - yMin) / range;
              const barHeight = Math.max(
                Math.min(normalizedValue * chartDimensions.chartHeight, chartDimensions.chartHeight),
                0
              );
              
              return (
                <Bar
                  key={point.date}
                  height={barHeight}
                  width={chartDimensions.barWidth}
                  color={metricColor}
                  animIndex={index}
                  date={point.date}
                  value={point.value}
                  dayName={point.dayName}
                  onPress={() => onBarSelect?.(point.value, point.date, point.dayName)}
                  isToday={DateUtils.isToday(point.date)}
                />
              );
            })}
          </View>
        </View>
      </View>
    </ChartErrorBoundary>
  );
}
