import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MetricCard } from './MetricCard';
import { MetricType } from '@/src/types/schemas';
import { healthMetrics } from '@/src/config/healthMetrics';
import { HealthMetrics } from '@/src/providers/health/types/metrics';
import { theme } from '@/src/theme/theme';

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
  const paperTheme = useTheme();

  // Define colors using our theme
  const metricColors: Record<DisplayedMetricType, string> = {
    steps: theme.colors.primary,
    distance: theme.colors.secondary,
    calories: theme.colors.tertiary,
    exercise: theme.colors.success,
    heart_rate: '#FF5252',
    basal_calories: '#9C27B0',
    flights_climbed: '#FF9800'
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

  return (
    <View style={[styles.container, { backgroundColor: paperTheme.colors.background }]}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cell: {
    width: '48%',
    minWidth: 150,
    maxWidth: 200,
  },
  lastCell: {
    width: '48%',
    minWidth: 150,
    maxWidth: 200,
    marginBottom: 16,
  }
});
