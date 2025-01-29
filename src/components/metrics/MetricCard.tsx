import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, ProgressBar, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedProps,
  withSpring,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { healthMetrics } from '@/src/config/healthMetrics';
import { MetricType } from '@/src/types/metrics';

// Create wrapped ProgressBar component
const AnimatedProgressBar = Animated.createAnimatedComponent(
  React.forwardRef<any, any>((props, ref) => <ProgressBar {...props} ref={ref} />)
);

const AnimatedText = Animated.createAnimatedComponent(Text);

interface BaseMetricProps {
  value: number;
  goal: number;
  color: string;
  showAlert?: boolean;
}

interface MetricCardProps extends BaseMetricProps {
  title: string;
  points: number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  unit: string;
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
  
  // Memoize progress calculation
  const progress = useMemo(() => calculateProgress(value, goal), [value, goal]);
  
  // Animation values
  const animatedProgress = useSharedValue(0);

  // Memoize animation config
  const springConfig = useMemo(() => ({
    damping: 15,
    stiffness: 100
  }), []);

  // Update animations with useCallback
  const updateProgress = useCallback(() => {
    animatedProgress.value = withSpring(progress, springConfig);
  }, [progress, springConfig]);

  // Update animations
  React.useEffect(() => {
    updateProgress();
  }, [updateProgress]);

  const progressBarProps = useAnimatedProps(() => ({
    progress: animatedProgress.value
  }));

  // Memoize value display
  const valueDisplay = useMemo(() => Math.round(value).toLocaleString(), [value]);
  const progressDisplay = useMemo(() =>
    `${Math.round(progress * 100)}% of ${goal.toLocaleString()} ${unit}`,
    [progress, goal, unit]
  );

  return (
    <Card style={[styles.card, style]}>
      <Card.Content style={styles.cardContent}>
        {showHeader && headerContent}
        <View style={styles.content}>
          <View style={styles.valueContainer}>
            <Text variant="headlineMedium" style={styles.value}>
              {valueDisplay}
            </Text>
            <Text variant="bodySmall" style={styles.unit}>
              {unit}
            </Text>
          </View>

          <AnimatedProgressBar
            progress={progress}
            animatedProps={progressBarProps}
            color={color || theme.colors.primary}
            style={styles.progressBar}
          />

          <Text variant="bodySmall" style={styles.progressText}>
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
  color,
  onPress
}: MetricCardProps) {
  const theme = useTheme();
  const animatedPoints = useSharedValue(0);

  // Memoize animation config
  const timingConfig = useMemo(() => ({
    duration: 1000
  }), []);

  // Update points animation with useCallback
  const updatePoints = useCallback(() => {
    animatedPoints.value = withTiming(points, timingConfig);
  }, [points, timingConfig]);

  React.useEffect(() => {
    updatePoints();
  }, [updatePoints]);

  // Memoize header content
  const headerContent = useMemo(() => (
    <View style={styles.header}>
      <View>
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
        <AnimatedText style={styles.points}>
          {Math.round(animatedPoints.value)} pts
        </AnimatedText>
      </View>
      <View style={[styles.iconContainer, { backgroundColor: color || theme.colors.primary }]}>
        <MaterialCommunityIcons
          name={icon}
          size={24}
          color="white"
        />
      </View>
    </View>
  ), [title, color, icon, theme.colors.primary, animatedPoints.value]);

  // Memoize style
  const cardStyle = useMemo(() =>
    onPress ? { cursor: 'pointer' } : undefined,
    [onPress]
  );

  return (
    <BaseMetricDisplay
      value={value}
      goal={goal}
      color={color}
      unit={unit}
      headerContent={headerContent}
      style={cardStyle}
    />
  );
}, (prevProps, nextProps) => {
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
      color={color}
      unit={config.displayUnit}
      showHeader={false}
      style={styles.detailCard}
    />
  );
}, (prevProps, nextProps) => {
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
    elevation: 4,
  },
  detailCard: {
    marginVertical: 16,
    marginHorizontal: 16,
    elevation: 4,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  cardContent: {
    padding: 16,
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#000',
    marginBottom: 4,
  },
  points: {
    fontSize: 14,
    color: '#666',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginRight: 8,
    color: '#000',
  },
  unit: {
    color: '#666',
  },
  
  // Progress styles
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressText: {
    color: '#666',
    textAlign: 'right',
  },
});
