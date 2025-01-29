import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MetricType } from '@/src/types/metrics';

interface MetricCardProps {
  title: string;
  value: number;
  points: number;
  goal: number;
  unit: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  progress: number;
  backgroundColor: string;
  onPress?: () => void;
}

export function MetricCard({
  title,
  value,
  points,
  goal,
  unit,
  icon,
  progress,
  backgroundColor,
  onPress
}: MetricCardProps) {
  const progressPercentage = Math.min(progress * 100, 100);

  return (
    <Pressable
      onPress={onPress}
      className={`${backgroundColor} p-4 rounded-3xl`}
    >
      <View className="flex-row justify-between items-start mb-2">
        <View>
          <Text className="text-white text-lg font-primary">{title}</Text>
          <Text className="text-white/80 text-sm font-secondary">
            {points} pts
          </Text>
        </View>
        <View className="bg-white/20 rounded-full p-2">
          <MaterialCommunityIcons name={icon} size={24} color="white" />
        </View>
      </View>

      <View className="space-y-2">
        <View className="flex-row items-baseline space-x-1">
          <Text className="text-white text-3xl font-bold font-primary">
            {Math.round(value).toLocaleString()}
          </Text>
          <Text className="text-white text-lg font-secondary">{unit}</Text>
        </View>

        {/* Progress Bar */}
        <View className="h-2 bg-white/20 rounded-full overflow-hidden">
          <View
            className="h-full bg-white rounded-full"
            style={{ width: `${progressPercentage}%` }}
          />
        </View>

        <Text className="text-white/80 text-sm font-secondary">
          {Math.round(progressPercentage)}% of goal
        </Text>
      </View>
    </Pressable>
  );
}
