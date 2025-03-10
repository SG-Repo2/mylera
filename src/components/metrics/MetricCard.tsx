import React, { useMemo, useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Text, useTheme, Surface, TouchableRipple, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { healthMetrics } from '@/src/config/healthMetrics';
import { MetricType } from '@/src/types/metrics';
import { useMetricCardStyles } from '@/src/styles/useMetricCardStyles';
import { useAuth } from '@/src/providers/AuthProvider';
import { DISPLAY_UNITS, MeasurementSystem } from '@/src/utils/unitConversion';
import { useMetricCardAnimations } from '@/src/hooks/useMetricCardAnimations';

interface MetricCardProps {
  title: string;
  value: number | null;
  goal: number;
  points: number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  unit: string;
  metricType: MetricType;
  color?: string;
  onPress: () => void;
  showAlert?: boolean;
  measurementSystem?: MeasurementSystem;
  valueChangeAnim?: Animated.Value;
}

const calculateProgress = (value: number | null, goal: number): number => {
  return Math.min((value ?? 0) / goal, 1);
};

export const MetricCard = React.memo(function MetricCard({
  title,
  value,
  goal,
  points,
  icon,
  unit,
  metricType,
  color,
  onPress,
  showAlert,
  measurementSystem: propMeasurementSystem,
  valueChangeAnim
}: MetricCardProps) {
  const styles = useMetricCardStyles();
  const theme = useTheme();
  const { user } = useAuth();
  
  const measurementSystem = useMemo(() => 
    propMeasurementSystem || (user?.user_metadata?.measurementSystem || 'metric') as MeasurementSystem,
    [propMeasurementSystem, user?.user_metadata?.measurementSystem]
  );
  
  const progress = useMemo(() => calculateProgress(value, goal), [value, goal]);
  const formattedValue = useMemo(() => 
    healthMetrics[metricType].formatValue(value ?? 0, measurementSystem),
    [value, metricType, measurementSystem]
  );
  const displayUnit = useMemo(() => 
    DISPLAY_UNITS[metricType][measurementSystem],
    [metricType, measurementSystem]
  );
  const percentage = useMemo(() => Math.round(progress * 100), [progress]);
  
  const {
    scaleAnim,
    glowAnim,
    combinedValueChangeAnim,
    backgroundColorAnim,
    handlePressIn,
    handlePressOut,
  } = useMetricCardAnimations({ value, valueChangeAnim });
  
  const cardBackgroundColorStyle = useMemo(() => {
    const pulseColor = color || theme.colors.primary;
    
    return {
      backgroundColor: backgroundColorAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [
          theme.colors.surface, 
          `${pulseColor}30`,
          theme.colors.surface
        ]
      })
    };
  }, [backgroundColorAnim, color, theme.colors.surface, theme.colors.primary]);
  
  const getPointsText = useMemo(() => {
    if (metricType === 'heart_rate') return '(zone)';
    const increment = healthMetrics[metricType].pointIncrement.value;
    if (increment === 1) return '(1 per)';
    if (increment < 1) return `(${Math.round(1/increment)} per)`;
    return `(1 per ${increment})`;
  }, [metricType]);

  return (
    <Animated.View 
      style={[
        styles.cardWrapper,
        {
          backgroundColor: theme.colors.surface,
          transform: [{ scale: scaleAnim }],
          shadowOpacity: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.1, 0.25]
          }),
          shadowColor: color,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [4, 8]
          }),
        }
      ]}
    >
      <Surface 
        style={[
          styles.cardShadowWrapper, 
          cardBackgroundColorStyle
        ]} 
        elevation={2}
      >
        <View style={styles.cardContentWrapper}>
          <TouchableRipple
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.ripple}
            borderless
          >
            <View style={styles.cardContent}>
              <View style={styles.headerRow}>
                <Surface style={[styles.iconContainer, { backgroundColor: color }]} elevation={4}>
                  <MaterialCommunityIcons name={icon} size={24} color="white" />
                </Surface>
                <Text variant="labelLarge" style={[styles.title, { color: theme.colors.onSurface }]}>
                  {title}
                </Text>
              </View>
              
              <View style={styles.valueContainer}>
                <Animated.View style={{ transform: [{ scale: combinedValueChangeAnim }] }}>
                  <Text variant="displaySmall" style={[styles.value, { color: theme.colors.onSurface }]}>
                    {formattedValue}
                  </Text>
                </Animated.View>
                <Text variant="labelMedium" style={[styles.unit, { color: theme.colors.onSurfaceVariant }]}>
                  {displayUnit}
                </Text>
              </View>

              <View style={styles.progressContainer}>
                <ProgressBar
                  progress={progress}
                  color={color}
                  style={styles.progressBar}
                />
                <View style={styles.progressInfo}>
                  <Text variant="labelSmall" style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
                    {percentage}% of goal
                  </Text>
                  <Text variant="labelSmall" style={[styles.pointsText, { color: theme.colors.onSurfaceVariant }]}>
                    {points} pts {getPointsText} {displayUnit}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableRipple>
        </View>
      </Surface>
    </Animated.View>
  );
});
