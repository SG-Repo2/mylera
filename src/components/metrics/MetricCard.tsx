import React, { useMemo } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { Card, Text, useTheme, Surface, TouchableRipple, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { healthMetrics } from '@/src/config/healthMetrics';
import { MetricType } from '@/src/types/metrics';
import { theme as appTheme } from '@/src/theme/theme';

// Individual Metric Card Component Props
interface MetricCardProps {
  title: string;
  value: number | null;
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
  value: number | null;
  goal: number;
  color?: string;
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
  color = appTheme.colors.primary,
  onPress
}: MetricCardProps) {
  const paperTheme = useTheme();
  const progress = useMemo(() => calculateProgress(value, goal), [value, goal]);
  const formattedValue = healthMetrics[metricType].formatValue(value ?? 0);
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
    <Animated.View 
      style={[
        styles.cardWrapper, 
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      {/* Outer surface for shadow */}
      <Surface 
        style={[
          styles.cardShadowWrapper, 
          { backgroundColor: paperTheme.colors.surface }
        ]} 
        elevation={2}
      >
        {/* Inner view for content with overflow handling */}
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
              <Text variant="labelLarge" style={[styles.title, { color: paperTheme.colors.onSurface }]}>
                {title}
              </Text>
            </View>
            
            <View style={styles.valueContainer}>
              <Text variant="displaySmall" style={[styles.value, { color: paperTheme.colors.onSurface }]}>
                {formattedValue}
              </Text>
              <Text variant="labelMedium" style={[styles.unit, { color: paperTheme.colors.onSurfaceVariant }]}>
                {unit}
              </Text>
            </View>

            <View style={styles.progressContainer}>
              <ProgressBar
                progress={progress}
                color={color}
                style={styles.progressBar}
              />
              <Text variant="labelSmall" style={[styles.progressText, { color: paperTheme.colors.onSurfaceVariant }]}>
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

export const MetricDetailCard = React.memo(function MetricDetailCard({
  metricType,
  value,
  goal,
  color,
}: MetricDetailCardProps) {
  const paperTheme = useTheme();
  const config = healthMetrics[metricType];
  const progress = useMemo(() => calculateProgress(value, goal), [value, goal]);
  const formattedValue = healthMetrics[metricType].formatValue(value ?? 0);
  const percentage = Math.round(progress * 100);
  
  return (
    <Surface 
      style={[
        styles.detailCardShadow, 
        { backgroundColor: paperTheme.colors.surface }
      ]} 
      elevation={2}
    >
      <View style={styles.detailCardContent}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.valueContainer}>
            <Text variant="headlineLarge" style={[styles.value, { color: paperTheme.colors.onSurface }]}>
              {formattedValue}
            </Text>
            <Text variant="titleSmall" style={[styles.unit, { color: paperTheme.colors.onSurfaceVariant }]}>
              {config.displayUnit}
            </Text>
          </View>

          <ProgressBar
            progress={progress}
            color={color || paperTheme.colors.primary}
            style={styles.progressBar}
          />

          <Text variant="bodySmall" style={[styles.progressText, { color: paperTheme.colors.onSurfaceVariant }]}>
            {percentage}% of {goal} {config.displayUnit}
          </Text>
        </Card.Content>
      </View>
    </Surface>
  );
});

const styles = StyleSheet.create({
  cardWrapper: {
    minHeight: 160,
    aspectRatio: 1,
  },
  cardShadowWrapper: {
    borderRadius: 16,
    height: '100%',
  },
  cardContentWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    height: '100%',
    backgroundColor: 'transparent',
  },
  detailCardShadow: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  detailCardContent: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  ripple: {
    borderRadius: 16,
    height: '100%',
  },
  cardContent: {
    padding: 16,
    gap: 8,
    height: '100%',
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // Color is passed as prop
  },
  title: {
    flex: 1,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontWeight: '600',
  },
  unit: {
    fontWeight: '500',
  },
  progressContainer: {
    gap: 4,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
  },
  progressText: {
    textAlign: 'right',
  }
});
