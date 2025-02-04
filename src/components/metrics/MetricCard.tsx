import React, { useMemo } from 'react';
import { View, Animated } from 'react-native';
import { Text, useTheme, Surface, TouchableRipple, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { healthMetrics } from '@/src/config/healthMetrics';
import { MetricType } from '@/src/types/metrics';
import { useMetricCardStyles } from '@/src/styles/useMetricCardStyles';

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
  showAlert
}: MetricCardProps) {
  const styles = useMetricCardStyles();
  const theme = useTheme();
  const progress = useMemo(() => calculateProgress(value, goal), [value, goal]);
  const formattedValue = healthMetrics[metricType].formatValue(value ?? 0);
  const percentage = Math.round(progress * 100);
  
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = React.useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = React.useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  }, [scaleAnim]);

  return (
    <Animated.View 
      style={[
        styles.cardWrapper, 
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      <Surface 
        style={[
          styles.cardShadowWrapper, 
          { backgroundColor: theme.colors.surface }
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
                <Text variant="displaySmall" style={[styles.value, { color: theme.colors.onSurface }]}>
                  {formattedValue}
                </Text>
                <Text variant="labelMedium" style={[styles.unit, { color: theme.colors.onSurfaceVariant }]}>
                  {unit}
                </Text>
              </View>

              <View style={styles.progressContainer}>
                <ProgressBar
                  progress={progress}
                  color={color}
                  style={styles.progressBar}
                />
                <Text variant="labelSmall" style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
                  {percentage}% of goal
                </Text>
              </View>
            </View>
          </TouchableRipple>
        </View>
      </Surface>
    </Animated.View>
  );
});
