import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GoalCelebration from './GoalCelebration';
import { useTheme } from 'react-native-paper';
import { MetricCard } from './MetricCard';
import { MetricModal } from './MetricCardModal';
import { MetricType } from '@/src/types/schemas';
import { healthMetrics } from '@/src/config/healthMetrics';
import { HealthMetrics } from '@/src/providers/health/types/metrics';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { useMetricCardListStyles } from '@/src/styles/useMetricCardListStyles';
import { useDataProvider } from '@/src/contexts/DataProvider';
import { MeasurementSystem, DISPLAY_UNITS } from '@/src/utils/unitConversion';
import { 
  useMetricCardListAnimations,
  areMetricsEqual,
  metricOrder
} from '@/src/hooks/useMetricCardListAnimations';
import { useGoalCelebration } from '@/src/hooks/useGoalCelebration';

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
  availableMetrics = new Set<string>(),
  hasMinimumMetrics = false
}: MetricCardListProps) {
  // Remove all the old celebration state
  const [selectedMetric, setSelectedMetric] = useState<MetricType | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [hasValidData, setHasValidData] = useState(false);
  const isFirstRender = useRef(true);
  const { styles, colors: metricColors } = useMetricCardListStyles();
  const theme = useTheme();
  const { measurementSystem } = useDataProvider();
  
  // Create a ref to track which metrics have already been celebrated for today
  const celebratedMetricsRef = useRef<Set<string>>(new Set());
  
  // Load previously celebrated metrics from storage
  useEffect(() => {
    const loadCelebratedMetrics = async () => {
      try {
        // Generate a key that includes the date to reset celebrations daily
        const today = new Date().toISOString().split('T')[0];
        const userId = metrics.user_id || 'anonymous';
        const storageKey = `celebrated_metrics_${userId}_${today}`;
        
        const storedMetrics = await AsyncStorage.getItem(storageKey);
        if (storedMetrics) {
          const metricsArray = JSON.parse(storedMetrics);
          celebratedMetricsRef.current = new Set(metricsArray);
          console.log(`[MetricCardList] Loaded celebrated metrics for today: ${metricsArray}`);
        } else {
          // Reset for a new day
          celebratedMetricsRef.current = new Set();
        }
      } catch (error) {
        console.error('[MetricCardList] Error loading celebrated metrics:', error);
        // Continue with empty set on error
        celebratedMetricsRef.current = new Set();
      }
    };
    
    if (metrics.user_id) {
      loadCelebratedMetrics();
    }
  }, [metrics.user_id]);
  
  // Save celebrated metrics to storage whenever they change
  const saveCelebratedMetrics = useCallback(async () => {
    if (!metrics.user_id) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const storageKey = `celebrated_metrics_${metrics.user_id}_${today}`;
      const metricsArray = Array.from(celebratedMetricsRef.current);
      
      await AsyncStorage.setItem(storageKey, JSON.stringify(metricsArray));
      console.log(`[MetricCardList] Saved celebrated metrics: ${metricsArray}`);
    } catch (error) {
      console.error('[MetricCardList] Error saving celebrated metrics:', error);
    }
  }, [metrics.user_id]);
  
  // Use the animation hook to handle animations
  const { fadeAnims, valueChangeAnims } = useMetricCardListAnimations(
    metrics,
    hasValidData,
    isManualRefresh
  );

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

  // Memoize modal handlers
  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    setSelectedMetric(null);
  }, []);

  const handleMetricPress = useCallback((metricType: MetricType) => {
    setSelectedMetric(metricType);
    setModalVisible(true);
  }, []);

  const {
    celebrationState,
    checkAndCelebrateGoal,
    closeCelebration,
    updateLastMetrics
  } = useGoalCelebration(metrics.user_id);

  // Update last metrics whenever metrics change
  useEffect(() => {
    const metricValues = Object.fromEntries(
      metricOrder.map(type => [type, metrics[type] as number])
    );
    updateLastMetrics(metricValues);
  }, [metrics, updateLastMetrics]);

  // Check for goal achievement
  useEffect(() => {
    if (!hasValidData || !showAlerts || !metrics.user_id) return;
    
    const checkMetrics = async () => {
      for (const metric of memoizedMetrics) {
        const { type, value } = metric;
        if (!value || value <= 0) continue;
        
        // Pass isInitialLoad to prevent celebration on first load
        const isInitialLoad = isFirstRender.current || isManualRefresh;
        if (await checkAndCelebrateGoal(type, value, isInitialLoad)) {
          break;
        }
      }
    };
    
    checkMetrics();
  }, [memoizedMetrics, hasValidData, showAlerts, metrics.user_id, checkAndCelebrateGoal, isManualRefresh]);

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
              onClose={handleModalClose}
              title={healthMetrics[selectedMetric].title}
              value={metrics[selectedMetric] as number || 0}
              metricType={selectedMetric}
              userId={metrics.user_id}
              date={metrics.date}
              provider={provider}
            />
          )}

      {/* Only keep this one celebration component */}
      {celebrationState.visible && (
        <GoalCelebration
          visible={celebrationState.visible}
          bonusPoints={celebrationState.points}
          metricType={celebrationState.metricType}
          metricName={celebrationState.metricName}
          onClose={closeCelebration}
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
