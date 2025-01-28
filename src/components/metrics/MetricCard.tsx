// src/components/metrics/MetricCard.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ColorScheme {
  bg: string;
  text: string;
  progressBg: string;
  progressFill: string;
  iconColor: string;
}

type ColorVariant = 'primary' | 'secondary' | 'red' | 'accent';

interface MetricCardProps {
  title: string;
  value: number;
  goal: number;
  unit: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  progress: number;
  color: ColorVariant;
  showAlert?: boolean;
  onPress?: () => void;
  points?: number;
  variant?: 'default' | 'wide';
}

export function MetricCard({
  title,
  value,
  goal,
  unit,
  icon,
  progress,
  color,
  showAlert,
  onPress,
  points = 0,
  variant = 'default'
}: MetricCardProps) {
  const colorSchemes: Record<ColorVariant, ColorScheme> = {
    primary: {
      bg: 'bg-primary',
      text: 'text-white',
      progressBg: 'bg-black/20',
      progressFill: 'bg-white',
      iconColor: '#FFFFFF',
    },
    secondary: {
      bg: 'bg-secondary',
      text: 'text-white',
      progressBg: 'bg-black/20',
      progressFill: 'bg-white',
      iconColor: '#FFFFFF',
    },
    red: {
      bg: 'bg-metric-red',
      text: 'text-white',
      progressBg: 'bg-black/20',
      progressFill: 'bg-white',
      iconColor: '#FFFFFF',
    },
    accent: {
      bg: 'bg-accent',
      text: 'text-white',
      progressBg: 'bg-black/20',
      progressFill: 'bg-white',
      iconColor: '#FFFFFF',
    }
  };

  const colors = colorSchemes[color];
  const progressPercentage = Math.min(progress * 100, 100);

  return (
    <Pressable
      onPress={onPress}
      className={`${colors.bg} rounded-xl p-4 relative overflow-hidden
                 ${variant === 'wide' ? 'flex-1' : 'flex-1'}`}
    >
      <View className="flex-row justify-between items-start mb-3">
        <View>
          <Text className={`${colors.text} text-lg font-medium`}>{title}</Text>
          <Text className={`${colors.text} opacity-80 text-xs`}>
            {points} pts
          </Text>
        </View>
        <View className={`${colors.progressBg} rounded-full p-2`}>
          <MaterialCommunityIcons 
            name={icon} 
            size={24} 
            color={colors.iconColor} 
          />
        </View>
      </View>

      <View className="space-y-3">
        <View className="flex-row items-baseline space-x-1">
          <Text className={`${colors.text} text-3xl font-bold`}>
            {Math.round(value).toLocaleString()}
          </Text>
          <Text className={`${colors.text} text-lg`}>{unit}</Text>
        </View>

        <View>
          <View className={`h-2 rounded-full ${colors.progressBg}`}>
            <View
              className={`h-full rounded-full ${colors.progressFill}`}
              style={{ width: `${progressPercentage}%` }}
            />
          </View>
          <Text className={`${colors.text} opacity-80 text-xs mt-1`}>
            {Math.round(progressPercentage)}% of goal
          </Text>
        </View>
      </View>

      {showAlert && (
        <View className="absolute top-4 right-4">
          <MaterialCommunityIcons 
            name="alert-circle" 
            size={24} 
            color={colors.iconColor} 
          />
        </View>
      )}
    </Pressable>
  );
}