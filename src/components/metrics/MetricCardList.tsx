import React, { useState, useCallback, useEffect } from 'react';
import { View, Animated } from 'react-native';
import GoalCelebration from './GoalCelebration';
import { useTheme } from 'react-native-paper';
import { MetricCard } from './MetricCard';
import { MetricModal } from './MetricCardModal';
import { MetricType } from '@/src/types/schemas';
import { healthMetrics } from '@/src/config/healthMetrics';
import { HealthMetrics } from '@/src/providers/health/types/metrics';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { useMetricCardListStyles } from '@/src/styles/useMetricCardListStyles';
import { useAuth } from '@/src/providers/AuthProvider';
import { MeasurementSystem, DISPLAY_UNITS } from '@/src/utils/unitConversion';

interface MetricCardListProps {
  metrics: HealthMetrics;
  showAlerts?: boolean;
  provider: HealthProvider;
}

type DisplayedMetricType = MetricType;

const calculateMetricPoints = (type: DisplayedMetricType, value: number | { systolic: number; diastolic: number }): number => {
  // Handle non-numeric values
  if (typeof value !== 'number') {
    return 0;
  }

  const config = healthMetrics[type];
  
  // Special handling for heart rate since it's based on target zone
  if (type === 'heart_rate') {
    const targetValue = config.defaultGoal;
    const deviation = Math.abs(value - targetValue);
    // Within 5 BPM = max points, then decreases linearly
    const points = Math.max(0, config.pointIncrement.maxPoints * (1 - deviation / 15));
    return Math.round(points);
  }

  // For all other metrics, calculate points based on increment value
  return Math.min(
    Math.floor(value / config.pointIncrement.value),
    config.pointIncrement.maxPoints
  );
};

const metricOrder: DisplayedMetricType[] = [
  'steps',
  'distance',
  'calories',
  'exercise',
  'heart_rate',
  'basal_calories',
  'flights_climbed'
];

// Add this utility function above the MetricCardList component
const areMetricsEqual = (prev: HealthMetrics, next: HealthMetrics): boolean => {
  if (prev === next) return true;
  if (!prev || !next) return false;
  
  // Only compare the actual metrics that affect what's displayed
  const metricKeys: (keyof HealthMetrics)[] = [
    'steps', 'distance', 'calories', 'heart_rate',
    'exercise', 'basal_calories', 'flights_climbed'
  ];
  
  return metricKeys.every(key => prev[key] === next[key]);
};

export const MetricCardList = React.memo(function MetricCardList({
  metrics,
  showAlerts = true,
  provider
}: MetricCardListProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPoints, setCelebrationPoints] = useState(0);
  const { styles, colors: metricColors } = useMetricCardListStyles();
  const theme = useTheme();
  const { user } = useAuth();
  const measurementSystem = (user?.user_metadata?.measurementSystem || 'metric') as MeasurementSystem;
  
  // Add tracking to reset animations when metrics change
  const prevMetricsIdRef = React.useRef<string | null>(null);
  const animationsRun = React.useRef(false);

  // Memoize metric values to prevent unnecessary re-renders
  const memoizedMetrics = React.useMemo(() => {
    return metricOrder.map(metricType => ({
      type: metricType,
      value: metrics[metricType] as number,
      points: calculateMetricPoints(metricType, metrics[metricType] || 0),
      config: healthMetrics[metricType]
    }));
  }, [metrics]);
  
  // Create fade-in animations for each card
  const fadeAnims = React.useRef(
    metricOrder.map(() => new Animated.Value(0))
  ).current;

  React.useEffect(() => {
    // Only run animations on initial render or if metrics ID changes
    const shouldRunAnimations = !animationsRun.current || metrics.id !== prevMetricsIdRef.current;
    prevMetricsIdRef.current = metrics.id;
    
    if (!shouldRunAnimations) return;
    
    // Reset animations first
    fadeAnims.forEach(anim => anim.setValue(0));
    
    // Enhanced stagger animation sequence
    const animations = fadeAnims.map((anim, index) =>
      Animated.sequence([
        Animated.delay(index * 80), // Slightly faster stagger for better flow
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          stiffness: 100,
          damping: 15,
          mass: 0.8,
        })
      ])
    );

    const animationController = Animated.stagger(50, animations);
    animationController.start(() => {
      animationsRun.current = true;
    });
    
    // Cleanup animation when component unmounts
    return () => {
      animationController.stop();
    };
  }, [fadeAnims, metrics.id]); // Add metrics.id as dependency

  // Memoize modal handlers
  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    setSelectedMetric(null);
  }, []);

  const handleMetricPress = useCallback((metricType: MetricType) => {
    setSelectedMetric(metricType);
    setModalVisible(true);
  }, []);

  // Check for goal achievement
  useEffect(() => {
    const stepsMetric = memoizedMetrics.find(m => m.type === 'steps');
    if (stepsMetric && stepsMetric.value >= stepsMetric.config.defaultGoal) {
      setShowCelebration(true);
      setCelebrationPoints(stepsMetric.points);
    }
  }, [memoizedMetrics]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {showCelebration && (
        <GoalCelebration
          visible={showCelebration}
          onClose={() => setShowCelebration(false)}
          bonusPoints={celebrationPoints}
        />
      )}
      {selectedMetric && (
          <MetricModal
            visible={modalVisible}
            onClose={handleModalClose}
            title={healthMetrics[selectedMetric].title}
            value={metrics[selectedMetric] || 0}
            metricType={selectedMetric}
            userId={metrics.user_id}
            date={metrics.date}
            provider={provider}
            additionalInfo={[
            {
              label: 'Daily Goal',
              value: `${healthMetrics[selectedMetric].defaultGoal} ${DISPLAY_UNITS[selectedMetric][measurementSystem]}`
            },
            {
              label: 'Progress',
              value: `${Math.round((metrics[selectedMetric] as number || 0) / healthMetrics[selectedMetric].defaultGoal * 100)}%`
            }
          ]}
        />
      )}
      <View style={styles.grid}>
        {memoizedMetrics.map(({ type: metricType, value, points, config }, index) => (
          <Animated.View 
            key={metricType} 
            style={[
              styles.cell,
              {
              opacity: fadeAnims[index],
              transform: [{
                translateY: fadeAnims[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0], // Increased range for more noticeable motion
                }),
              }, {
                scale: fadeAnims[index].interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.8, 1.02, 1], // Add slight overshoot
                }),
              }],
              },
              index === metricOrder.length - 1 && styles.lastCell
            ]}
          >
            <MetricCard
              title={config.title}
              value={value}
              points={points}
              goal={config.defaultGoal as number}
              unit={DISPLAY_UNITS[metricType][measurementSystem]}
              icon={config.icon}
              color={metricColors[metricType]}
              showAlert={showAlerts}
              metricType={metricType}
              measurementSystem={measurementSystem}
              onPress={() => handleMetricPress(metricType)}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.showAlerts === nextProps.showAlerts &&
    prevProps.provider === nextProps.provider &&
    areMetricsEqual(prevProps.metrics, nextProps.metrics)
  );
});
