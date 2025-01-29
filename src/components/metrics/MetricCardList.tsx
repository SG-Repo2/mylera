import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MetricCard } from './MetricCard';
import type { MetricType } from '../../types/metrics';
import { healthMetrics } from '../../config/healthMetrics';
import type { HealthMetrics } from '../../providers/health/types/metrics';
import { getMetricValue, calculateProgress } from '../../utils/metrics/calculations';

interface MetricCardListProps {
  metrics: HealthMetrics;
  totalPoints: number;
}

const backgroundColors: Record<MetricType, string> = {
  steps: 'bg-metric-green',
  heart_rate: 'bg-metric-red',
  calories: 'bg-metric-purple',
  distance: 'bg-metric-blue',
  standing: 'bg-metric-yellow',
  exercise: 'bg-gray-500'
};

export function MetricCardList({ metrics, totalPoints }: MetricCardListProps) {
  return (
    <View className="p-4 space-y-4">
      {/* Total Points Card */}
      <View className="bg-white p-4 rounded-xl shadow-sm">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-primary text-gray-800">Total Points</Text>
          <View className="flex-row items-center space-x-2">
            <MaterialCommunityIcons name="chart-line" size={24} color="#10B981" />
            <Text className="text-2xl font-bold">
              {totalPoints} <Text className="text-gray-500 text-lg">/ 1000</Text>
            </Text>
          </View>
        </View>
        <View className="mt-4 bg-gray-100 h-2 rounded-full overflow-hidden">
          <View
            className="h-full bg-metric-green rounded-full"
            style={{ width: `${(totalPoints / 1000) * 100}%` }}
          />
        </View>
      </View>

      {/* Metric Cards Grid */}
      <View className="space-y-4">
        {Object.entries(healthMetrics).map(([key, config]) => {
          const type = key as MetricType;
          const value = getMetricValue(metrics, type);
          const progress = calculateProgress(value, config);
          const metricPoints = metrics[type] || 0;

          return (
            <MetricCard
              key={type}
              title={config.title}
              value={value}
              points={metricPoints}
              goal={config.defaultGoal}
              unit={config.displayUnit}
              icon={config.icon as keyof typeof MaterialCommunityIcons.glyphMap}
              progress={progress}
              backgroundColor={backgroundColors[type] || 'bg-gray-500'}
            />
          );
        })}
      </View>
    </View>
  );
}