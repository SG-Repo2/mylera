import React, { useState } from 'react';
import { View, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MetricCard } from './MetricCard';
import { MetricModal } from './MetricCardModal';
import { MetricType } from '@/src/types/schemas';
import { healthMetrics } from '@/src/config/healthMetrics';
import { HealthMetrics } from '@/src/providers/health/types/metrics';
import { useMetricCardListStyles } from '@/src/styles/useMetricCardListStyles';

interface MetricCardListProps {
  metrics: HealthMetrics;
  showAlerts?: boolean;
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
  showAlerts = true
}: MetricCardListProps) {
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

  // Sample data for the weekly view
  const generateSampleWeekData = (metricType: MetricType, currentValue: number) => {
    const values = Array.from({ length: 7 }, () => 
      Math.max(0, currentValue * (0.7 + Math.random() * 0.6))
    );
    values[6] = currentValue; // Today's value
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return {
      values,
      labels,
      startDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
    };
  };

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
          data={generateSampleWeekData(selectedMetric, metrics[selectedMetric] as number || 0)}
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
