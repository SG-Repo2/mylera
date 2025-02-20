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
import { calculateMetricPoints, type MetricScore } from '@/src/utils/scoringUtils';

interface MetricCardListProps {
  metrics: HealthMetrics;
  showAlerts?: boolean;
  provider: HealthProvider;
}

const metricOrder: MetricType[] = [
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

  // Memoize metric scores using the scoring utility
  const memoizedMetrics = React.useMemo(() => {
    return metricOrder.map(metricType => {
      const config = healthMetrics[metricType];
      const value = metrics[metricType] as number;
      const score = calculateMetricPoints(metricType, value || 0, config);
      
      return {
        type: metricType,
        score,
        config: healthMetrics[metricType]
      };
    });
  }, [metrics]);

  // Create fade-in animations for each card
  const fadeAnims = React.useRef(
    metricOrder.map(() => new Animated.Value(0))
  ).current;

  React.useEffect(() => {
    const animations = fadeAnims.map((anim, index) =>
      Animated.sequence([
        Animated.delay(index * 80),
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          stiffness: 100,
          damping: 15,
          mass: 0.8,
        })
      ])
    );

    Animated.stagger(50, animations).start();
  }, [fadeAnims]);

  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    setSelectedMetric(null);
  }, []);

  const handleMetricPress = useCallback((metricType: MetricType) => {
    setSelectedMetric(metricType);
    setModalVisible(true);
  }, []);

  // Check for goal achievement using the score
  useEffect(() => {
    const stepsMetric = memoizedMetrics.find(m => m.type === 'steps');
    if (stepsMetric && stepsMetric.score.goalReached) {
      setShowCelebration(true);
      setCelebrationPoints(stepsMetric.score.points);
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
        {memoizedMetrics.map(({ type: metricType, score, config }, index) => (
          <Animated.View key={metricType} style={[styles.cell, fadeAnims[index]]}>
            <MetricCard
              title={config.title}
              metricType={metricType}
              score={score}
              icon={config.icon}
              color={metricColors[metricType]}
              showAlert={showAlerts}
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
    JSON.stringify(prevProps.metrics) === JSON.stringify(nextProps.metrics)
  );
});
