import React, { useMemo } from 'react';
import { View, Dimensions, Animated } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MetricType } from '@/src/types/metrics';
import { brandColors } from '@/src/theme/theme';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import Svg, { Rect } from 'react-native-svg';
import healthMetrics from '@/src/config/healthMetrics';
import { getYAxisConfig, formatTickValue } from '../../utils/metricUtils';
import { MeasurementSystem } from '../../types/metrics';
import useBarChartStyles from '../../styles/useBarChartStyles';
import { useBarChartData, DataPoint } from '@/src/hooks/useBarChartData';

interface BarChartProps {
  metricType: MetricType;
  userId: string;
  date: string;
  provider: HealthProvider;
  measurementSystem: MeasurementSystem;
}


export const BarChart = React.memo(function BarChart({ metricType, userId, date, provider, measurementSystem }: BarChartProps) {
  const theme = useTheme();
  const styles = useBarChartStyles();
  
  // Use the custom hook for chart data
  const { loading, error, data, chartMetrics } = useBarChartData(provider, metricType, userId, date);

  // Move all useMemo hooks to the top level
  const chartWidth = useMemo(() => Math.max(Dimensions.get('window').width - 48, 100), []);
  const chartHeight = useMemo(() => 220, []);
  const barWidth = useMemo(() => Math.max((chartWidth - 40) / 7 - 8, 20), []); // Use fixed value 7 for data points

  // Calculate Y-axis configuration using useMemo
  const yAxisConfig = useMemo(() => 
    getYAxisConfig(metricType, chartMetrics.maxValue, measurementSystem),
    [metricType, chartMetrics.maxValue, measurementSystem]
  );

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
          {error.message}
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
                        inputRange: [0, 0.8, 0.9, 1],
                        outputRange: [0.3, 1.05, 1.02, 1],
                      })
                    }],
                    transformOrigin: 'bottom'
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
