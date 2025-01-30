import React, { useMemo } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { Card, Text, ProgressBar, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { healthMetrics } from '@/src/config/healthMetrics';
import { MetricType } from '@/src/types/metrics';
import { theme } from '@/src/theme/theme';

// Helper function to get metric color
const getMetricColor = (metricType: MetricType, fallbackColor: string): string => {
  return healthMetrics[metricType]?.color || fallbackColor;
};

interface BaseMetricProps {
  value: number;
  goal: number;
  color?: string;
  showAlert?: boolean;
}

interface MetricCardProps extends BaseMetricProps {
  title: string;
  points: number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  unit: string;
  metricType: MetricType;
  onPress?: () => void;
}

interface MetricDetailCardProps extends BaseMetricProps {
  metricType: MetricType;
  onRetry?: () => void;
}

// Memoized progress calculation
const calculateProgress = (value: number, goal: number): number => {
  return Math.min(value / goal, 1);
};

const BaseMetricDisplay = React.memo(function BaseMetricDisplay({
  value,
  goal,
  color,
  unit,
  showHeader = true,
  headerContent,
  style
}: {
  value: number;
  goal: number;
  color: string;
  unit: string;
  showHeader?: boolean;
  headerContent?: React.ReactNode;
  style?: any;
}) {
  const theme = useTheme();
  
  const progress = useMemo(() => calculateProgress(value, goal), [value, goal]);
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: progress,
      useNativeDriver: false,
      damping: 15,
      stiffness: 100
    }).start();
  }, [progress]);

  const valueDisplay = useMemo(() => Math.round(value).toLocaleString(), [value]);
  const progressDisplay = useMemo(() =>
    `${Math.round(progress * 100)}% of ${goal.toLocaleString()} ${unit}`,
    [progress, goal, unit]
  );

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }, style]}>
      <Card.Content style={styles.cardContent}>
        {showHeader && headerContent}
        <View style={styles.content}>
          <View style={styles.valueContainer}>
            <Text variant="headlineLarge" style={[styles.value, { color: theme.colors.onSurface }]}>
              {valueDisplay}
            </Text>
            <Text variant="titleSmall" style={[styles.unit, { color: theme.colors.onSurfaceVariant }]}>
              {unit}
            </Text>
          </View>

          <ProgressBar
            progress={progress}
            color={color}
            style={styles.progressBar}
          />

          <Text variant="bodySmall" style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
            {progressDisplay}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
});

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
  const pointsAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(pointsAnim, {
      toValue: points,
      duration: 1000,
      useNativeDriver: false
    }).start();
  }, [points]);

  const animatedPoints = pointsAnim.interpolate({
    inputRange: [0, points],
    outputRange: [0, points]
  });

  const headerContent = useMemo(() => (
    <View style={styles.header}>
      <View style={styles.headerTextContainer}>
        <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
          {title}
        </Text>
        <Animated.Text style={[styles.points, { color }]} numberOfLines={1}>
          {animatedPoints.interpolate({
            inputRange: [0, points],
            outputRange: [`0 pts`, `${Math.round(points)} pts`]
          })}
        </Animated.Text>
      </View>
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <MaterialCommunityIcons
          name={icon}
          size={28}
          color={theme.colors.surface}
        />
      </View>
    </View>
  ), [title, color, icon, theme.colors.surface, animatedPoints, points]);

  return (
    <BaseMetricDisplay
      value={value}
      goal={goal}
      color={color}
      unit={unit}
      headerContent={headerContent}
      style={onPress ? { cursor: 'pointer' } : undefined}
    />
  );
}, (prevProps: MetricCardProps, nextProps: MetricCardProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.goal === nextProps.goal &&
    prevProps.points === nextProps.points &&
    prevProps.color === nextProps.color &&
    prevProps.title === nextProps.title &&
    prevProps.icon === nextProps.icon &&
    prevProps.unit === nextProps.unit &&
    prevProps.onPress === nextProps.onPress
  );
});

export const MetricDetailCard = React.memo(function MetricDetailCard({
  metricType,
  value,
  goal,
  color,
}: MetricDetailCardProps) {
  const config = healthMetrics[metricType];
  
  return (
    <BaseMetricDisplay
      value={value}
      goal={goal}
      color={color || theme.colors.primary}
      unit={config.displayUnit}
      showHeader={false}
      style={styles.detailCard}
    />
  );
}, (prevProps: MetricDetailCardProps, nextProps: MetricDetailCardProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.goal === nextProps.goal &&
    prevProps.color === nextProps.color &&
    prevProps.metricType === nextProps.metricType
  );
});

const styles = StyleSheet.create({
  // Base card styles
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
    elevation: 2,
    borderRadius: theme.roundness * 2,
  },
  detailCard: {
    marginVertical: 16,
    marginHorizontal: 16,
    elevation: 2,
    borderRadius: theme.roundness * 2,
  },
  cardContent: {
    padding: 16,
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600',
    marginBottom: 2,
  },
  points: {
    fontSize: 14,
    fontWeight: '500',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  
  // Content styles
  content: {
    marginTop: 8,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  value: {
    marginRight: 4,
    fontWeight: '700',
  },
  unit: {
    fontWeight: '500',
    marginTop: 'auto',
  },
  
  // Progress styles
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 6,
    backgroundColor: `${theme.colors.surfaceVariant}40`,
  },
  progressText: {
    textAlign: 'right',
    marginTop: 2,
  },
});
