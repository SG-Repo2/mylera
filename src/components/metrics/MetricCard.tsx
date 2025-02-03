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
    borderRadius: 20,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContentWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    height: '100%',
    backgroundColor: 'transparent',
  },
  detailCardShadow: {
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailCardContent: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  ripple: {
    borderRadius: 20,
    height: '100%',
  },
  cardContent: {
    padding: 14,
    gap: 10,
    height: '100%',
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // Color is passed as prop
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontWeight: '700',
    fontSize: 28,
  },
  unit: {
    fontWeight: '600',
    opacity: 0.8,
  },
  progressContainer: {
    gap: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 3,
  },
  progressText: {
    textAlign: 'right',
    fontSize: 12,
    opacity: 0.7,
  }
});
