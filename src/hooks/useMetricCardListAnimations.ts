import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import { HealthMetrics } from '@/src/providers/health/types/metrics';
import { MetricType } from '@/src/types/schemas';

type DisplayedMetricType = MetricType;

// Utility function to compare metrics equality
const areMetricsEqual = (prev: HealthMetrics, next: HealthMetrics): boolean => {
  // Compare only metric values that affect the display
  return (
    metricOrder.every(metricType => {
      const prevValue = prev[metricType];
      const nextValue = next[metricType];

      // Consider null and undefined equal for comparison
      if (prevValue == null && nextValue == null) return true;

      // Compare numeric values directly
      return prevValue === nextValue;
    }) && prev.daily_score === next.daily_score
  ); // Also compare the daily score
};

// Function to log metric changes
const logMetricChanges = (
  metricOrder: DisplayedMetricType[],
  prev: HealthMetrics | null,
  next: HealthMetrics
) => {
  if (!prev) {
    console.log(
      '[MetricCardList] Initial metrics load:',
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
    if (typeof prevValue !== 'number' || typeof nextValue !== 'number' || prevValue === nextValue) {
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

// The order of metrics to display
const metricOrder: DisplayedMetricType[] = [
  'steps',
  'distance',
  'calories',
  'exercise',
  'heart_rate',
  'basal_calories',
  'flights_climbed',
];

export interface MetricCardAnimations {
  fadeAnims: Animated.Value[];
  valueChangeAnims: Animated.Value[];
  animationsRun: React.MutableRefObject<boolean>;
}

export function useMetricCardListAnimations(
  metrics: HealthMetrics,
  hasValidData: boolean,
  isManualRefresh: boolean
): MetricCardAnimations {
  // Create refs for value change animations
  const valueChangeAnims = useRef(metricOrder.map(() => new Animated.Value(0))).current;

  // Create fade-in animations for each card
  const fadeAnims = useRef(metricOrder.map(() => new Animated.Value(0))).current;

  // Track if animations have been run
  const animationsRun = useRef(false);

  // Track previous metrics to detect changes
  const prevMetricsRef = useRef<HealthMetrics | null>(null);

  // Run fade-in animations only when we have valid data
  useEffect(() => {
    if (!hasValidData || animationsRun.current) return;

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
        }),
      ])
    );

    // Start all animations and mark as complete
    Animated.parallel(animations).start(() => {
      animationsRun.current = true;
    });
  }, [fadeAnims, hasValidData]);

  // Check if metrics have changed and trigger animations
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
              }),
            ]).start();
          }
        });
      }

      // Only reset fade-in animations on initial load or explicit manual refresh
      if (
        !prevMetricsRef.current ||
        (isManualRefresh && !areMetricsEqual(prevMetricsRef.current, metrics))
      ) {
        animationsRun.current = false;
      }

      prevMetricsRef.current = metrics;
    }
  }, [metrics, valueChangeAnims, isManualRefresh]);

  return {
    fadeAnims,
    valueChangeAnims,
    animationsRun,
  };
}

// Export utility functions so they can be used in MetricCardList
export { areMetricsEqual, logMetricChanges, metricOrder };
