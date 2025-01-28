// src/components/metrics/MetricCard.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

// This type defines which icon set and name to use for each metric type
type IconConfig = {
  set: 'MaterialCommunityIcons' | 'Ionicons';
  name: string;
};

// Icon mappings for different metric types
const ICON_MAPPINGS: Record<string, IconConfig> = {
  steps: { set: 'MaterialCommunityIcons', name: 'shoe-print' },
  heart: { set: 'Ionicons', name: 'heart' },
  distance: { set: 'MaterialCommunityIcons', name: 'map-marker-distance' },
  calories: { set: 'MaterialCommunityIcons', name: 'fire' },
};

interface MetricCardProps {
  title: string;
  value: number;
  goal: number;
  unit: string;
  icon: keyof typeof ICON_MAPPINGS;
  progress: number;
  color: string;
  showAlert?: boolean;
  onPress?: () => void;
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
  onPress
}: MetricCardProps) {
  // Color mappings for different states
  const colors = {
    primary: {
      bg: 'bg-primary',
      text: 'text-white',
      progressBg: 'bg-white/20',
      progressFill: 'bg-white',
      iconColor: '#FFFFFF',
    },
    red: {
      bg: 'bg-red-500',
      text: 'text-white',
      progressBg: 'bg-white/20',
      progressFill: 'bg-white',
      iconColor: '#FFFFFF',
    },
    blue: {
      bg: 'bg-blue-500',
      text: 'text-white',
      progressBg: 'bg-white/20',
      progressFill: 'bg-white',
      iconColor: '#FFFFFF',
    },
    orange: {
      bg: 'bg-orange-500',
      text: 'text-white',
      progressBg: 'bg-white/20',
      progressFill: 'bg-white',
      iconColor: '#FFFFFF',
    },
  }[color] ?? {
    bg: 'bg-gray-500',
    text: 'text-white',
    progressBg: 'bg-white/20',
    progressFill: 'bg-white',
    iconColor: '#FFFFFF',
  };

  const progressPercentage = Math.min(progress * 100, 100);
  const isGoalMet = progressPercentage >= 100;

  // Function to render the appropriate icon based on the icon config
  const renderIcon = () => {
    const iconConfig = ICON_MAPPINGS[icon];
    if (!iconConfig) return null;

    return iconConfig.set === 'MaterialCommunityIcons' ? (
      <MaterialCommunityIcons 
        name={iconConfig.name as any} 
        size={24} 
        color={colors .iconColor} 
      />
    ) : (
      <Ionicons 
        name={iconConfig.name as any} 
        size={24} 
        color={colors.iconColor} 
      />
    );
  };

  return (
    <Pressable
      onPress={onPress}
      className={`${colors.bg} rounded-xl p-4 relative overflow-hidden`}
    >
      {/* Header */}
      <View className="flex-row justify-between items-start mb-3">
        <View>
          <Text className={`${colors.text} text-lg font-medium`}>{title}</Text>
          <Text className={`${colors.text} opacity-80 text-sm`}>
            {Math.round(progressPercentage)}% of goal
          </Text>
        </View>
        <View className={`${colors.progressBg} rounded-full p-2`}>
          {renderIcon()}
        </View>
      </View>

      {/* Value and Progress */}
      <View className="space-y-3">
        <View className="flex-row items-baseline space-x-1">
          <Text className={`${colors.text} text-3xl font-bold`}>
            {Math.round(value).toLocaleString()}
          </Text>
          <Text className={`${colors.text} text-lg`}>{unit}</Text>
        </View>

        {/* Progress Bar */}
        <View className={`w-full h-2 rounded-full ${colors.progressBg}`}>
          <View
            className={`h-full rounded-full ${colors.progressFill} transition-all duration-300`}
            style={{ width: `${progressPercentage}%` }}
          />
        </View>

        {/* Goal Met Indicator */}
        {isGoalMet && (
          <View className="flex-row items-center space-x-2">
            <View className={`${colors.progressBg} rounded-full px-2 py-1`}>
              <Text className={`${colors.text} text-xs font-medium`}>
                Goal Met! 🎯
              </Text>
            </View>
          </View>
        )}

        {/* Alert Indicator */}
        {showAlert && (
          <View className="absolute top-4 right-4">
            <MaterialCommunityIcons 
              name="alert-circle" 
              size={24} 
              color={colors.iconColor} 
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}