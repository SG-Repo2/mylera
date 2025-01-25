import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface MetricCardProps {
  title: string;
  value: number;
  goal: number;
  points: number;
  unit: string;
  onPress?: () => void;
}

export function MetricCard({
  title,
  value,
  goal,
  points,
  unit,
  onPress
}: MetricCardProps) {
  // Calculate progress percentage
  const progress = Math.min(Math.max((value / goal) * 100, 0), 100);
  const isGoalReached = value >= goal;

  return (
    <Pressable
      className="bg-white p-4 rounded-lg shadow"
      onPress={onPress}
      disabled={!onPress}
    >
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-lg font-semibold text-text-primary">
          {title}
        </Text>
        <View className="bg-primary/10 px-2 py-1 rounded">
          <Text className="text-primary text-sm font-medium">
            {points} pts
          </Text>
        </View>
      </View>

      <Text className="text-3xl font-bold text-primary">
        {value.toLocaleString()} <Text className="text-lg">{unit}</Text>
      </Text>

      {/* Progress bar */}
      <View className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
        <View 
          className={`h-full rounded-full ${
            isGoalReached ? 'bg-status-success' : 'bg-primary'
          }`}
          style={{ width: `${progress}%` }}
        />
      </View>

      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-text-secondary">
          Goal: {goal.toLocaleString()} {unit}
        </Text>
        {isGoalReached && (
          <Text className="text-status-success font-medium">
            Goal Reached!
          </Text>
        )}
      </View>
    </Pressable>
  );
}