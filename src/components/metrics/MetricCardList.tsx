// src/components/metrics/MetricCardList.tsx
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MetricCard } from './MetricCard';
import { MetricType } from '../../types/metrics';
import { healthMetrics } from '../../config/healthMetrics';
import { getMetricValue, calculateProgress, shouldShowAlert } from '../../utils/metrics/calculations';
import { HealthMetrics } from '@/src/providers/health';

interface MetricCardListProps {
  metrics: HealthMetrics;
  showAlerts?: boolean;
}

export function MetricCardList({ metrics, showAlerts = true }: MetricCardListProps) {
  const totalPoints = Object.entries(healthMetrics).reduce((sum, [key, config]) => {
    const type = key as MetricType;
    const value = getMetricValue(metrics, type);
    const progress = calculateProgress(value, config);
    return sum + Math.round(progress * 250); // 250 points max per metric
  }, 0);

  return (
    <View className="p-4 space-y-4">
      {/* Header */}
      <View>
        <Text className="text-gray-600">Good afternoon, Alex</Text>
        <Text className="text-2xl font-bold">Your Dashboard</Text>
      </View>

      {/* Total Points Card */}
      <View className="bg-gray-50 rounded-xl p-4">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-gray-600">Total Points</Text>
          <View className="flex-row items-center space-x-2">
          <MaterialCommunityIcons name="chart-line" size={20} color="#183E9F" />
          <Text className="text-xl font-bold">{totalPoints}</Text>
            <Text className="text-gray-500">/ 1000</Text>
          </View>
        </View>
        <View className="h-2 bg-gray-200 rounded-full">
          <View
            className="h-full bg-secondary rounded-full"
            style={{ width: `${(totalPoints / 1000) * 100}%` }}
          />
        </View>
      </View>

      {/* Steps - Wide Card */}
      <MetricCard
        title="Steps"
        value={getMetricValue(metrics, 'steps')}
        goal={healthMetrics.steps.defaultGoal}
        unit={healthMetrics.steps.displayUnit}
        icon="shoe-print"
        progress={calculateProgress(getMetricValue(metrics, 'steps'), healthMetrics.steps)}
        color="secondary"
        variant="wide"
        points={Math.round(calculateProgress(getMetricValue(metrics, 'steps'), healthMetrics.steps) * 250)}
      />

      {/* Heart Rate & Calories */}
      <View className="flex-row space-x-4">
        <MetricCard
          title="Heart Rate"
          value={getMetricValue(metrics, 'heart_rate')}
          goal={healthMetrics.heart_rate.defaultGoal}
          unit={healthMetrics.heart_rate.displayUnit}
          icon="heart-pulse"
          progress={calculateProgress(getMetricValue(metrics, 'heart_rate'), healthMetrics.heart_rate)}
          color="red"
          points={Math.round(calculateProgress(getMetricValue(metrics, 'heart_rate'), healthMetrics.heart_rate) * 250)}
          showAlert={shouldShowAlert('heart_rate', getMetricValue(metrics, 'heart_rate'), healthMetrics.heart_rate)}
        />
        
        <MetricCard
          title="Calories"
          value={getMetricValue(metrics, 'calories')}
          goal={healthMetrics.calories.defaultGoal}
          unit={healthMetrics.calories.displayUnit}
          icon="fire"
          progress={calculateProgress(getMetricValue(metrics, 'calories'), healthMetrics.calories)}
          color="primary"
          points={Math.round(calculateProgress(getMetricValue(metrics, 'calories'), healthMetrics.calories) * 250)}
        />
      </View>

      {/* Distance - Wide Card */}
      <MetricCard
        title="Distance"
        value={getMetricValue(metrics, 'distance')}
        goal={healthMetrics.distance.defaultGoal}
        unit={healthMetrics.distance.displayUnit}
        icon="map-marker-distance"
        progress={calculateProgress(getMetricValue(metrics, 'distance'), healthMetrics.distance)}
        color="accent"
        variant="wide"
        points={Math.round(calculateProgress(getMetricValue(metrics, 'distance'), healthMetrics.distance) * 250)}
      />
    </View>
  );
}