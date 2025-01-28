import { View } from 'react-native';
import { MetricCard } from './MetricCard';
import { MetricType } from '../../types/metrics';
import { healthMetrics } from '../../config/healthMetrics';
import { HealthMetrics } from '../../providers/health/types/metrics';
import { getMetricValue, calculateProgress, shouldShowAlert } from '../../utils/metrics/calculations';

interface MetricCardListProps {
  metrics: HealthMetrics;
  showAlerts?: boolean;
}

export function MetricCardList({ metrics, showAlerts = true }: MetricCardListProps) {

  return (
    <View className="p-4 space-y-4">
      {Object.entries(healthMetrics).map(([key, config]) => {
        const type = key as MetricType;
        const value = getMetricValue(metrics, type);
        const progress = calculateProgress(value, config);
        const alert = showAlerts && shouldShowAlert(type, value, config);

        return (
          <MetricCard
            key={type}
            title={config.title}
            value={value}
            goal={config.defaultGoal}
            unit={config.displayUnit}
            icon={config.icon}
            progress={progress}
            color={config.color}
            showAlert={alert}
          />
        );
      })}
    </View>
  );
}