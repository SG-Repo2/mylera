import React, { useMemo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Text, useTheme, Surface, TouchableRipple, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { healthMetrics } from '@/src/config/healthMetrics';
import { MetricType } from '@/src/types/metrics';
import { useMetricCardStyles } from '@/src/styles/useMetricCardStyles';
import { useAuth } from '@/src/providers/AuthProvider';
import { DISPLAY_UNITS, MeasurementSystem } from '@/src/utils/unitConversion';

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
}: MetricCardProps) {
  const styles = useMetricCardStyles();
  const theme = useTheme();
  const { user } = useAuth();
  const measurementSystem =
    propMeasurementSystem ||
    ((user?.user_metadata?.measurementSystem || 'metric') as MeasurementSystem);

  const progress = useMemo(() => calculateProgress(value, goal), [value, goal]);
  const formattedValue = healthMetrics[metricType].formatValue(value ?? 0, measurementSystem);
  const displayUnit = DISPLAY_UNITS[metricType][measurementSystem];
  const percentage = Math.round(progress * 100);

  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = React.useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        stiffness: 200,
        damping: 15,
        mass: 0.8,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, glowAnim]);

  const handlePressOut = React.useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 200,
        damping: 15,
        mass: 0.8,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, glowAnim]);

  const getPointsText = () => {
    if (metricType === 'heart_rate') {
      return '(zone)';
    }
    const increment = healthMetrics[metricType].pointIncrement.value;
    if (increment === 1) {
      return '(1 per)';
    }
    if (increment < 1) {
      return `(${Math.round(1 / increment)} per)`;
    }
    return `(1 per ${increment})`;
  };

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          transform: [{ scale: scaleAnim }],
          shadowOpacity: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.1, 0.25],
          }),
          shadowColor: color,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [4, 8],
          }),
        },
      ]}
    >
      <Surface
        style={[styles.cardShadowWrapper, { backgroundColor: theme.colors.surface }]}
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
                <Text
                  variant="labelLarge"
                  style={[styles.title, { color: theme.colors.onSurface }]}
                >
                  {title}
                </Text>
              </View>

              <View style={styles.valueContainer}>
                <Text
                  variant="displaySmall"
                  style={[styles.value, { color: theme.colors.onSurface }]}
                >
                  {formattedValue}
                </Text>
                <Text
                  variant="labelMedium"
                  style={[styles.unit, { color: theme.colors.onSurfaceVariant }]}
                >
                  {displayUnit}
                </Text>
              </View>

              <View style={styles.progressContainer}>
                <ProgressBar progress={progress} color={color} style={styles.progressBar} />
                <View style={styles.progressInfo}>
                  <Text
                    variant="labelSmall"
                    style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {percentage}% of goal
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={[styles.pointsText, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {points} pts {getPointsText()} {displayUnit}
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
