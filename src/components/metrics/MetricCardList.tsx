import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MetricCard } from './MetricCard';
import { MetricType } from '@/src/types/metrics';
import { healthMetrics } from '@/src/config/healthMetrics';
import { HealthMetrics } from '@/src/providers/health/types/metrics';

interface MetricCardListProps {
  metrics: HealthMetrics;
  showAlerts?: boolean;
}

type DisplayedMetricType = 'steps' | 'heart_rate' | 'calories' | 'distance';

const calculateMetricPoints = (type: DisplayedMetricType, value: number): number => {
  const maxPoints = {
    steps: 165,
    heart_rate: 250,
    calories: 188,
    distance: 160
  };
  
  return Math.min(
    Math.round((value / healthMetrics[type].defaultGoal) * maxPoints[type]),
    maxPoints[type]
  );
};

export const MetricCardList = React.memo(function MetricCardList({ 
  metrics, 
  showAlerts = true 
}: MetricCardListProps) {
  const theme = useTheme();
  const colors = React.useMemo(() => ({
    primary: theme.colors.primary,
    'metric-red': '#FF5252',
    accent: theme.colors.secondary,
    secondary: '#F7A072'
  }), [theme.colors.primary, theme.colors.secondary]);

  return (
    <View style={styles.container}>
      <View style={styles.cardList}>
        {/* Steps Card - Full Width */}
        <MetricCard
          title={healthMetrics.steps.title}
          value={metrics.steps || 0}
          points={calculateMetricPoints('steps', metrics.steps || 0)}
          goal={healthMetrics.steps.defaultGoal}
          unit={healthMetrics.steps.displayUnit}
          icon={healthMetrics.steps.icon}
          color={colors[healthMetrics.steps.color as keyof typeof colors]}
          showAlert={showAlerts}
        />

        {/* Heart Rate and Calories Row */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <MetricCard
              title={healthMetrics.heart_rate.title}
              value={metrics.heart_rate || 0}
              points={calculateMetricPoints('heart_rate', metrics.heart_rate || 0)}
              goal={healthMetrics.heart_rate.defaultGoal}
              unit={healthMetrics.heart_rate.displayUnit}
              icon={healthMetrics.heart_rate.icon}
              color={colors[healthMetrics.heart_rate.color as keyof typeof colors]}
              showAlert={showAlerts}
            />
          </View>
          <View style={styles.halfWidth}>
            <MetricCard
              title={healthMetrics.calories.title}
              value={metrics.calories || 0}
              points={calculateMetricPoints('calories', metrics.calories || 0)}
              goal={healthMetrics.calories.defaultGoal}
              unit={healthMetrics.calories.displayUnit}
              icon={healthMetrics.calories.icon}
              color={colors[healthMetrics.calories.color as keyof typeof colors]}
              showAlert={showAlerts}
            />
          </View>
        </View>

        {/* Distance Card - Full Width */}
        <MetricCard
          title={healthMetrics.distance.title}
          value={metrics.distance || 0}
          points={calculateMetricPoints('distance', metrics.distance || 0)}
          goal={healthMetrics.distance.defaultGoal}
          unit={healthMetrics.distance.displayUnit}
          icon={healthMetrics.distance.icon}
          color={colors[healthMetrics.distance.color as keyof typeof colors]}
          showAlert={showAlerts}
        />
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
    paddingHorizontal: 16,
  },
  cardList: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  halfWidth: {
    flex: 1,
  },
});