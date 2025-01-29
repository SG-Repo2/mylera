import { View, StyleSheet } from 'react-native';
import { MetricCard } from './MetricCard';
import { MetricType } from '../../types/metrics';
import { healthMetrics } from '../../config/healthMetrics';
import { HealthMetrics } from '../../providers/health/types/metrics';
import { getMetricValue, calculateProgress, shouldShowAlert } from '../../utils/metrics/calculations';

interface MetricCardListProps {
  metrics: HealthMetrics;
  showAlerts?: boolean;
}

// Define the metrics we're actually displaying
type DisplayedMetricType = 'steps' | 'heart_rate' | 'calories' | 'distance';

// Helper function to calculate points for each metric
const calculateMetricPoints = (type: DisplayedMetricType, value: number): number => {
  const pointsMap = {
    steps: (val: number) => Math.round((val / 10000) * 165), // 165 max points
    heart_rate: (val: number) => Math.round((val / 100) * 250), // 250 max points
    calories: (val: number) => Math.round((val / 600) * 188), // 188 max points
    distance: (val: number) => Math.round((val / 5) * 160), // 160 max points
  };

  const maxPoints = {
    steps: 165,
    heart_rate: 250,
    calories: 188,
    distance: 160
  };

  return Math.min(pointsMap[type](value), maxPoints[type]);
};

export function MetricCardList({ metrics, showAlerts = true }: MetricCardListProps) {
  return (
    <View style={styles.container}>
      <View style={styles.cardList}>
        {/* Steps Card - Full Width */}
        <MetricCard
          title="Steps"
          value={getMetricValue(metrics, 'steps')}
          points={calculateMetricPoints('steps', getMetricValue(metrics, 'steps'))}
          goal={healthMetrics.steps.defaultGoal}
          unit={healthMetrics.steps.displayUnit}
          icon={healthMetrics.steps.icon}
          progress={calculateProgress(getMetricValue(metrics, 'steps'), healthMetrics.steps)}
          color="primary"
          showAlert={showAlerts && shouldShowAlert('steps', getMetricValue(metrics, 'steps'), healthMetrics.steps)}
        />

        {/* Heart Rate and Calories - Side by Side */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <MetricCard
              title="Heart Rate"
              value={getMetricValue(metrics, 'heart_rate')}
              points={calculateMetricPoints('heart_rate', getMetricValue(metrics, 'heart_rate'))}
              goal={healthMetrics.heart_rate.defaultGoal}
              unit={healthMetrics.heart_rate.displayUnit}
              icon={healthMetrics.heart_rate.icon}
              progress={calculateProgress(getMetricValue(metrics, 'heart_rate'), healthMetrics.heart_rate)}
              color="metric-red"
              showAlert={showAlerts && shouldShowAlert('heart_rate', getMetricValue(metrics, 'heart_rate'), healthMetrics.heart_rate)}
            />
          </View>
          <View style={styles.halfWidth}>
            <MetricCard
              title="Calories"
              value={getMetricValue(metrics, 'calories')}
              points={calculateMetricPoints('calories', getMetricValue(metrics, 'calories'))}
              goal={healthMetrics.calories.defaultGoal}
              unit={healthMetrics.calories.displayUnit}
              icon={healthMetrics.calories.icon}
              progress={calculateProgress(getMetricValue(metrics, 'calories'), healthMetrics.calories)}
              color="accent"
              showAlert={showAlerts && shouldShowAlert('calories', getMetricValue(metrics, 'calories'), healthMetrics.calories)}
            />
          </View>
        </View>

        {/* Distance Card - Full Width */}
        <MetricCard
          title="Distance"
          value={getMetricValue(metrics, 'distance')}
          points={calculateMetricPoints('distance', getMetricValue(metrics, 'distance'))}
          goal={healthMetrics.distance.defaultGoal}
          unit={healthMetrics.distance.displayUnit}
          icon={healthMetrics.distance.icon}
          progress={calculateProgress(getMetricValue(metrics, 'distance'), healthMetrics.distance)}
          color="secondary"
          showAlert={showAlerts && shouldShowAlert('distance', getMetricValue(metrics, 'distance'), healthMetrics.distance)}
        />
      </View>
    </View>
  );
}

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