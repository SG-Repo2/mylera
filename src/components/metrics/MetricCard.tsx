import React from 'react';
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
  const progress = Math.min(value / goal, 1);
  
  // Animation values
  const animatedProgress = useSharedValue(0);

  // Update animations
  React.useEffect(() => {
    animatedProgress.value = withSpring(progress, {
      damping: 15,
      stiffness: 100
    });
  }, [progress]);

  const progressBarProps = useAnimatedProps(() => ({
    progress: animatedProgress.value
  }));

  return (
    <Card style={[styles.card, style]}>
      <Card.Content style={styles.cardContent}>
        {showHeader && headerContent}
        <View style={styles.content}>
          <View style={styles.valueContainer}>
            <Text variant="headlineMedium" style={styles.value}>
              {Math.round(value).toLocaleString()}
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
            {Math.round(progress * 100)}% of {goal.toLocaleString()} {unit}
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

  React.useEffect(() => {
    animatedPoints.value = withTiming(points, {
      duration: 1000
    });
  }, [points]);

  const headerContent = (
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
  );

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
}, (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.goal === nextProps.goal &&
    prevProps.points === nextProps.points &&
    prevProps.color === nextProps.color
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
    prevProps.color === nextProps.color
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
