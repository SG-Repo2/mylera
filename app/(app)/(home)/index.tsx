import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Button } from 'react-native';
import { MetricCard } from '@/src/components/metrics/MetricCard';
import { useAuth } from '@/src/providers/AuthProvider';
import { metricsService } from '@/src/services/metricsService';
import type { MetricType } from '@/src/types/metrics';

interface MetricState {
  value: number;
  goal: number;
  unit: string;
}

export function MetricsDashboardScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  
  const [metrics, setMetrics] = useState<Record<MetricType, MetricState>>({
    steps: { value: 6000, goal: 10000, unit: 'steps' },
    distance: { value: 3.2, goal: 5, unit: 'km' },
    calories: { value: 1800, goal: 2000, unit: 'kcal' },
    heart_rate: { value: 70, goal: 120, unit: 'bpm' },
    exercise: { value: 25, goal: 30, unit: 'min' },
    standing: { value: 8, goal: 12, unit: 'hr' }
  });

  const handleSyncData = async () => {
    if (!userId) return;
    
    const updates = Object.entries(metrics).map(([type, data]) => 
      metricsService.updateMetric(userId, {
        type: type as MetricType,
        value: data.value,
        goal: data.goal
      })
    );

    await Promise.all(updates);
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4">
        <Text className="text-xl font-semibold mb-3">Your Metrics</Text>
        
        {Object.entries(metrics).map(([type, data]) => (
          <MetricCard
            key={type}
            title={type.charAt(0).toUpperCase() + type.slice(1)}
            value={data.value}
            goal={data.goal}
            points={data.value >= data.goal ? 25 : 0}
            unit={data.unit}
          />
        ))}
        
        <Button title="Sync and Update Scores" onPress={handleSyncData} />
      </View>
    </ScrollView>
  );
}