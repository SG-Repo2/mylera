import React, { useState } from 'react';
import { View, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MetricCard } from './MetricCard';
import { MetricModal } from './MetricCardModal';
import { MetricType } from '@/src/types/schemas';
import { healthMetrics } from '@/src/config/healthMetrics';
import { HealthMetrics } from '@/src/providers/health/types/metrics';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { useMetricCardListStyles } from '@/src/styles/useMetricCardListStyles';

interface MetricCardListProps {
  metrics: HealthMetrics;
  showAlerts?: boolean;
  provider: HealthProvider;
}

type DisplayedMetricType = MetricType;

const calculateMetricPoints = (type: DisplayedMetricType, value: number | { systolic: number; diastolic: number }): number => {
  const maxPoints: Record<DisplayedMetricType, number> = {
    steps: 165,
    heart_rate: 250,
    calories: 188,
    distance: 160,
    exercise: 200,
    basal_calories: 150,
    flights_climbed: 100,
  };

  // Handle numeric values only since blood pressure is handled separately
  if (typeof value !== 'number') {
    return 0;
  }

  return Math.min(
    Math.round((value / healthMetrics[type].defaultGoal) * maxPoints[type]),
    maxPoints[type]
  );
};

export const MetricCardList = React.memo(function MetricCardList({
  metrics,
  showAlerts = true,
  provider
}: MetricCardListProps) {
  // Debug log
  console.log('MetricCardList metrics:', metrics);
  const [selectedMetric, setSelectedMetric] = useState<MetricType | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { styles, colors: metricColors } = useMetricCardListStyles();
  const theme = useTheme();

  const metricOrder: DisplayedMetricType[] = [
    'steps',
    'distance',
    'calories',
    'exercise',
    'heart_rate',
    'basal_calories',
    'flights_climbed'
  ];

  // Create fade-in animations for each card
  const fadeAnims = React.useRef(
    metricOrder.map(() => new Animated.Value(0))
  ).current;

  React.useEffect(() => {
    // Stagger the animations
    const animations = fadeAnims.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 500,
        delay: index * 100, // Stagger by 100ms
        useNativeDriver: true,
      })
    );

    Animated.parallel(animations).start();
  }, []);

  const handleMetricPress = (metricType: MetricType) => {
    setSelectedMetric(metricType);
    setModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {selectedMetric && (
          <MetricModal
            visible={modalVisible}
            onClose={() => {
              setModalVisible(false);
              setSelectedMetric(null);
            }}
            title={healthMetrics[selectedMetric].title}
            value={metrics[selectedMetric] || 0}
            metricType={selectedMetric}
            userId={metrics.user_id}
            date={metrics.date}
            provider={provider}
            additionalInfo={[
            {
              label: 'Daily Goal',
              value: `${healthMetrics[selectedMetric].defaultGoal} ${healthMetrics[selectedMetric].displayUnit}`
            },
            {
              label: 'Progress',
              value: `${Math.round((metrics[selectedMetric] as number || 0) / healthMetrics[selectedMetric].defaultGoal * 100)}%`
            }
          ]}
        />
      )}
      <View style={styles.grid}>
        {metricOrder.map((metricType, index) => (
          <Animated.View 
            key={metricType} 
            style={[
              styles.cell,
              {
                opacity: fadeAnims[index],
                transform: [{
                  translateY: fadeAnims[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
              },
              index === metricOrder.length - 1 && styles.lastCell
            ]}
          >
            <MetricCard
              title={healthMetrics[metricType].title}
              value={metrics[metricType] as number}
              points={calculateMetricPoints(metricType, metrics[metricType] || 0)}
              goal={healthMetrics[metricType].defaultGoal as number}
              unit={healthMetrics[metricType].displayUnit}
              icon={healthMetrics[metricType].icon}
              color={metricColors[metricType]}
              showAlert={showAlerts}
              metricType={metricType}
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
