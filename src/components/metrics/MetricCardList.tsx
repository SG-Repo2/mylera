import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MetricCard } from './MetricCard';
import { MetricType } from '@/src/types/metrics';
import { healthMetrics } from '@/src/config/healthMetrics';
import { HealthMetrics } from '@/src/providers/health/types/metrics';
import { theme } from '@/src/theme/theme';

interface MetricCardListProps {
  metrics: HealthMetrics;
  showAlerts?: boolean;
}

type DisplayedMetricType = 'steps' | 'heart_rate' | 'calories' | 'distance' | 'sleep';

const calculateMetricPoints = (type: DisplayedMetricType, value: number): number => {
  const maxPoints = {
    steps: 165,
    heart_rate: 250,
    calories: 188,
    distance: 160,
    sleep: 200
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
  const paperTheme = useTheme();

  // Define colors using our theme
  const metricColors = {
    steps: theme.colors.primary,      // Blue
    distance: theme.colors.secondary, // Coral
    calories: theme.colors.tertiary,  // Light blue
    sleep: theme.colors.success,      // Green
    heart_rate: '#FF5252'            // Red for heart rate
  };

  const metricOrder: DisplayedMetricType[] = ['steps', 'distance', 'calories', 'sleep', 'heart_rate'];

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {metricOrder.map((metricType, index) => (
          <View key={metricType} style={[
            styles.cell,
            index === metricOrder.length - 1 && styles.lastCell
          ]}>
            <MetricCard
              title={healthMetrics[metricType].title}
              value={metrics[metricType] || 0}
              points={calculateMetricPoints(metricType, metrics[metricType] || 0)}
              goal={healthMetrics[metricType].defaultGoal}
              unit={healthMetrics[metricType].displayUnit}
              icon={healthMetrics[metricType].icon}
              color={metricColors[metricType]}
              showAlert={showAlerts}
              metricType={metricType}
            />
          </View>
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
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cell: {
    width: '48%',  // Just under 50% to account for gap
    aspectRatio: 1, // Make cells square
  },
  lastCell: {
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '48%',
  }
});