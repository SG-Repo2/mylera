import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function MetricDetailsScreen() {
  const { metric } = useLocalSearchParams();
  
  return (
    <View className="flex-1 p-4">
      <Text className="text-xl font-primary">
        {metric} Details
      </Text>
    </View>
  );
}