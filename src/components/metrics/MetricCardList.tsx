import React, { useState, useCallback, useEffect, useRef } from 'react';
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

// Add this utility function above the MetricCardList component
const areMetricsEqual = (prev: HealthMetrics, next: HealthMetrics): boolean => {
  if (prev === next) return true;
  if (!prev || !next) return false;
  
  // Only compare the actual metrics that affect what's displayed
  const metricKeys: (keyof HealthMetrics)[] = [
    'steps', 'distance', 'calories', 'heart_rate',
    'exercise', 'basal_calories', 'flights_climbed'
  ];
  
  // Return false if any key has changed - forces re-render
  return metricKeys.every(key => prev[key] === next[key]);
};

// Add function to log metric changes
const logMetricChanges = (metricOrder: DisplayedMetricType[], prev: HealthMetrics | null, next: HealthMetrics) => {
  if (!prev) {
    console.log('[MetricCardList] Initial metrics load');
    return;
  }
  
  let changed = false;
  metricOrder.forEach(metric => {
    if (prev[metric] !== next[metric]) {
      console.log(`[MetricCardList] Metric ${metric} changed: ${prev[metric]} -> ${next[metric]}`);
      changed = true;
    }
  });
  
  return changed;
};

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
  const prevMetricsRef = useRef<HealthMetrics | null>(null);
  const animationsRun = useRef(false);
  
  // Create refs for value change animations
  const valueChangeAnims = useRef(
    metricOrder.map(() => new Animated.Value(0))
  ).current;
  
  // Create fade-in animations for each card
  const fadeAnims = useRef(
    metricOrder.map(() => new Animated.Value(0))
  ).current;

  // Check if metrics have changed
  useEffect(() => {
    // Log metrics changes
    if (prevMetricsRef.current !== metrics) {
      const hasChanged = logMetricChanges(metricOrder, prevMetricsRef.current, metrics);
      
      // If metrics have changed, trigger value change animations
      if (prevMetricsRef.current && hasChanged) {
        console.log('[MetricCardList] Metrics values changed, triggering animations');
        
        // Trigger value change animations for each metric
        metricOrder.forEach((metric, index) => {
          if (prevMetricsRef.current && prevMetricsRef.current[metric] !== metrics[metric]) {
            // Reset animation value
            valueChangeAnims[index].setValue(0);
            
            // Play pulsing animation
            Animated.sequence([
              Animated.timing(valueChangeAnims[index], {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(valueChangeAnims[index], {
                toValue: 0,
                duration: 250, 
                useNativeDriver: true,
              })
            ]).start();
          }
        });
      }
      
      // If this is the first time seeing metrics or metrics have significantly changed,
      // reset fade-in animations
      if (!prevMetricsRef.current || !areMetricsEqual(prevMetricsRef.current, metrics)) {
        animationsRun.current = false;
      }
      
      prevMetricsRef.current = metrics;
    }
  }, [metrics, valueChangeAnims]);

  // Memoize metric values to prevent unnecessary re-renders
  const memoizedMetrics = React.useMemo(() => {
    console.log('[MetricCardList] Recalculating memoized metrics');
    return metricOrder.map(metricType => ({
      type: metricType,
      value: metrics[metricType] as number,
      points: calculateMetricPoints(metricType, metrics[metricType] || 0),
      config: healthMetrics[metricType]
    }));
  }, [metrics]);

  // Run fade-in animations
  React.useEffect(() => {
    // Only run animations on initial render or if animations need to be reset
    if (animationsRun.current) return;
    
    // Reset animations first
    fadeAnims.forEach(anim => anim.setValue(0));
    
    // Enhanced stagger animation sequence
    const animations = fadeAnims.map((anim, index) =>
      Animated.sequence([
        Animated.delay(index * 80), // Stagger delay
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 12,
          stiffness: 100,
        })
      ])
    );
    
    // Start all animations and mark as complete
    Animated.parallel(animations).start(() => {
      animationsRun.current = true;
    });
  }, [fadeAnims, metrics]);

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
    <View style={styles.container}>
      <View style={styles.grid}>
        {memoizedMetrics.map((metric, index) => {
          const metricType = metric.type as MetricType;
          const fadeAnim = fadeAnims[index]; // Get the fade animation for this card
          const valueAnim = valueChangeAnims[index]; // Get the value change animation for this card
          
          return (
            <Animated.View
              key={metricType}
              style={[
                styles.cell,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
                index === metricOrder.length - 1 && styles.lastCell
              ]}
            >
              <MetricCard
                title={healthMetrics[metricType].title}
                value={metric.value}
                goal={healthMetrics[metricType].defaultGoal}
                points={metric.points}
                icon={healthMetrics[metricType].icon}
                unit={healthMetrics[metricType].unit}
                metricType={metricType}
                color={metricColors[metricType]}
                onPress={() => handleMetricPress(metricType)}
                showAlert={showAlerts}
                measurementSystem={measurementSystem}
                valueChangeAnim={valueAnim}
              />
            </Animated.View>
          );
        })}
      </View>
      
      {selectedMetric && (
        <MetricModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          title={healthMetrics[selectedMetric].title}
          value={metrics[selectedMetric] as number || 0}
          metricType={selectedMetric}
          userId={metrics.user_id}
          date={metrics.date}
          provider={provider}
        />
      )}

      <GoalCelebration
        visible={showCelebration}
        bonusPoints={celebrationPoints}
        onClose={() => setShowCelebration(false)}
      />
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.showAlerts === nextProps.showAlerts &&
    prevProps.provider === nextProps.provider &&
    areMetricsEqual(prevProps.metrics, nextProps.metrics)
  );
});
