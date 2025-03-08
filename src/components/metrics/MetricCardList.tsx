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
  provider: HealthProvider;
  showAlerts: boolean;
  isInitialLoad: boolean;
  isManualRefresh: boolean;
  availableMetrics: Set<string>;
  hasMinimumMetrics: boolean;
}

type DisplayedMetricType = MetricType;

// Add constants for metric importance
const CRITICAL_METRICS = ['steps', 'distance', 'calories'] as const;
const IMPORTANT_METRICS = ['heart_rate', 'basal_calories'] as const;
const OPTIONAL_METRICS = ['flights_climbed', 'exercise'] as const;

// Add this utility function above the MetricCardList component
const areMetricsEqual = (prev: HealthMetrics, next: HealthMetrics): boolean => {
  // Compare only metric values that affect the display
  return metricOrder.every(metricType => {
    const prevValue = prev[metricType];
    const nextValue = next[metricType];
    
    // Consider null and undefined equal for comparison
    if (prevValue == null && nextValue == null) return true;
    
    // Compare numeric values directly
    return prevValue === nextValue;
  }) && prev.daily_score === next.daily_score; // Also compare the daily score
};

// Update the logMetricChanges function to only consider metric value changes
const logMetricChanges = (metricOrder: DisplayedMetricType[], prev: HealthMetrics | null, next: HealthMetrics) => {
  if (!prev) {
    console.log('[MetricCardList] Initial metrics load:', 
      metricOrder.map(metric => `${metric}: ${next[metric]}`).join(', ')
    );
    return true; // Initial load is always a change
  }
  
  // Check if any of the actual metric values have changed
  let hasActualChanges = false;
  const changedMetrics: string[] = [];
  
  metricOrder.forEach(metricType => {
    const prevValue = prev[metricType];
    const nextValue = next[metricType];
    
    // Skip non-numeric metrics and those that haven't changed
    if (
      typeof prevValue !== 'number' ||
      typeof nextValue !== 'number' ||
      prevValue === nextValue
    ) {
      return;
    }
    
    // Record changed metrics
    hasActualChanges = true;
    changedMetrics.push(`${metricType}: ${prevValue} → ${nextValue}`);
  });
  
  if (hasActualChanges) {
    console.log('[MetricCardList] Metrics changed:', changedMetrics.join(', '));
  } else {
    console.log('[MetricCardList] No metric value changes detected');
  }
  
  return hasActualChanges;
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

// Add validation function for individual metrics
const isValidMetricValue = (value: number | null): boolean => {
  return value !== null && value > 0;
};

// Update validation function to be more lenient
const validateMetricSet = (metrics: HealthMetrics): boolean => {
  // Check if we have ANY valid metrics
  const allMetricTypes = [...CRITICAL_METRICS, ...IMPORTANT_METRICS, ...OPTIONAL_METRICS];
  
  // Return true if at least one valid metric is available
  return allMetricTypes.some(metric => isValidMetricValue(metrics[metric]));
};

export const MetricCardList = React.memo(function MetricCardList({
  metrics,
  showAlerts = true,
  provider,
  isInitialLoad = false,
  isManualRefresh = false,
  availableMetrics,
  hasMinimumMetrics
}: MetricCardListProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPoints, setCelebrationPoints] = useState(0);
  const { styles, colors: metricColors } = useMetricCardListStyles();
  const theme = useTheme();
  const { user } = useAuth();
  const measurementSystem = (user?.user_metadata?.measurementSystem || 'metric') as MeasurementSystem;
  
  // Add state for tracking valid data
  const [hasValidData, setHasValidData] = useState(false);
  const isFirstRender = useRef(true);
  
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

  // Validate metrics when they change
  useEffect(() => {
    if (metrics) {
      const isValid = validateMetricSet(metrics);
      setHasValidData(isValid);
      
      if (isFirstRender.current) {
        isFirstRender.current = false;
      }
    }
  }, [metrics]);

  // Memoize metric values to prevent unnecessary re-renders
  const memoizedMetrics = React.useMemo(() => {
    console.log('[MetricCardList] Recalculating memoized metrics');
    
    // Return null values if data is not valid and not first render
    if (!hasValidData && !isFirstRender.current) {
      return metricOrder.map(metricType => ({
        type: metricType,
        value: null,
        points: 0,
        config: healthMetrics[metricType]
      }));
    }
    
    return metricOrder.map(metricType => ({
      type: metricType,
      value: metrics[metricType] as number,
      points: calculateMetricPoints(metricType, metrics[metricType] || 0),
      config: healthMetrics[metricType]
    }));
  }, [metrics, hasValidData]);

  // Run fade-in animations only when we have valid data
  React.useEffect(() => {
    if (!hasValidData || animationsRun.current) return;
    
    // Reset animations first
    fadeAnims.forEach(anim => anim.setValue(0));
    
    // Enhanced stagger animation sequence
    const animations = fadeAnims.map((anim, index) =>
      Animated.sequence([
        Animated.delay(index * 80), // Stagger delay
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,  // Already correct
          damping: 12,
          stiffness: 100,
        })
      ])
    );
    
    // Start all animations and mark as complete
    Animated.parallel(animations).start(() => {
      animationsRun.current = true;
    });
  }, [fadeAnims, hasValidData]);

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
      
      // Only reset fade-in animations on initial load or explicit manual refresh
      // Not during automatic background refreshes
      if (!prevMetricsRef.current || (isManualRefresh && !areMetricsEqual(prevMetricsRef.current, metrics))) {
        animationsRun.current = false;
      }
      
      prevMetricsRef.current = metrics;
    }
  }, [metrics, valueChangeAnims, isManualRefresh]);

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
    if (stepsMetric && stepsMetric.value && stepsMetric.value >= stepsMetric.config.defaultGoal) {
      setShowCelebration(true);
      setCelebrationPoints(stepsMetric.points);
    }
  }, [memoizedMetrics]);

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {memoizedMetrics.map((metric, index) => {
          const metricType = metric.type as MetricType;
          const fadeAnim = fadeAnims[index];
          const valueAnim = valueChangeAnims[index];
          
          // Show metric if it has a valid value, regardless of overall dataset validation
          const showMetric = (hasValidData || isFirstRender.current) && 
                           (metric.value !== null && metric.value !== undefined);
          if (!showMetric) return null;
          
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
                showAlert={showAlerts && hasValidData}
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

      {showCelebration && (
        <GoalCelebration
          visible={showCelebration}
          bonusPoints={celebrationPoints}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.showAlerts === nextProps.showAlerts &&
    prevProps.provider === nextProps.provider &&
    areMetricsEqual(prevProps.metrics, nextProps.metrics)
  );
});
