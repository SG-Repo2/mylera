import React, { useMemo } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { Card, Text, useTheme, Surface, ProgressBar, TouchableRipple } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { healthMetrics } from '@/src/config/healthMetrics';
import { MetricType } from '@/src/types/metrics';
import { theme } from '@/src/theme/theme';

interface MetricCardProps {
  title: string;
  value: number;
  goal: number;
  points: number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  unit: string;
  metricType: MetricType;
  color?: string;
  onPress?: () => void;
  showAlert?: boolean;
}

interface MetricDetailCardProps {
  metricType: MetricType;
  value: number;
  goal: number;
  color?: string;
}

const calculateProgress = (value: number, goal: number): number => {
  return Math.min(value / goal, 1);
};

const AnimatedSurface = Animated.createAnimatedComponent(Surface);

export const MetricCard = React.memo(function MetricCard({
  title,
  value,
  goal,
  points,
  icon,
  unit,
  metricType,
  color = theme.colors.primary,
  onPress
}: MetricCardProps) {
  const theme = useTheme();
  const progress = useMemo(() => calculateProgress(value, goal), [value, goal]);
  const formattedValue = healthMetrics[metricType].formatValue(value);
  const percentage = Math.round(progress * 100);

  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedSurface
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      elevation={2}
    >
      <TouchableRipple
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.ripple}
      >
        <View style={styles.cardContent}>
          <View style={styles.topRow}>
            <View style={styles.valueContainer}>
              <Text variant="headlineMedium" style={[styles.value, { color: theme.colors.onSurface }]}>
                {formattedValue}
              </Text>
              <Text variant="labelMedium" style={[styles.unit, { color: theme.colors.onSurfaceVariant }]}>
                {unit}
              </Text>
            </View>
            
            <Surface
              style={[styles.iconContainer, { backgroundColor: color }]}
              elevation={4}
            >
              <MaterialCommunityIcons
                name={icon}
                size={24}
                color={theme.colors.surface}
              />
            </Surface>
          </View>

          <View style={styles.centerContainer}>
            <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
          </View>

          <View style={styles.progressContainer}>
            <ProgressBar
              progress={progress}
              color={color}
              style={styles.progressBar}
            />
            <Text variant="labelSmall" style={[styles.progressText, { color }]}>
              {percentage}% of goal
            </Text>
          </View>
        </View>
      </TouchableRipple>
    </AnimatedSurface>
  );
});

export const MetricDetailCard = React.memo(function MetricDetailCard({
  metricType,
  value,
  goal,
  color,
}: MetricDetailCardProps) {
  const theme = useTheme();
  const config = healthMetrics[metricType];
  const progress = useMemo(() => calculateProgress(value, goal), [value, goal]);
  const formattedValue = config.formatValue(value);
  const percentage = Math.round(progress * 100);
  
  return (
    <Surface style={[styles.detailCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.valueContainer}>
          <Text variant="headlineLarge" style={[styles.value, { color: theme.colors.onSurface }]}>
            {formattedValue}
          </Text>
          <Text variant="titleSmall" style={[styles.unit, { color: theme.colors.onSurfaceVariant }]}>
            {config.displayUnit}
          </Text>
        </View>

        <ProgressBar
          progress={progress}
          color={color || theme.colors.primary}
          style={styles.progressBar}
        />

        <Text variant="bodySmall" style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
          {percentage}% of {goal} {config.displayUnit}
        </Text>
      </Card.Content>
    </Surface>
  );
});

const styles = StyleSheet.create({
  ripple: {
    borderRadius: theme.roundness * 2,
  },
  card: {
    marginVertical: 6,
    marginHorizontal: 6,
    borderRadius: theme.roundness * 2,
    minHeight: 140,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
    height: '100%',
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    paddingRight: 8,
  },
  value: {
    fontWeight: '700',
    marginRight: 8,
  },
  unit: {
    fontWeight: '500',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  title: {
    fontWeight: '600',
  },
  progressContainer: {
    width: '100%',
    marginTop: 'auto',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressText: {
    textAlign: 'right',
    fontWeight: '500',
  },
  detailCard: {
    marginVertical: 16,
    marginHorizontal: 16,
    borderRadius: theme.roundness * 2,
  }
});
