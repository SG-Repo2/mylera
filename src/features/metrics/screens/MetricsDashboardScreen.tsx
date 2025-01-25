import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Button } from 'react-native';
import { MetricCard } from '../components/MetricCard';
import { useAuth } from '@/providers/AuthProvider';
import { updateDailyMetricScore, updateDailyTotal } from '@/services/metricsService';

export function MetricsDashboardScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  
  // Example local states (normally from device or hooks)
  const [steps, setSteps] = useState(6000);
  const [distance, setDistance] = useState(3.2); // miles
  const [calories, setCalories] = useState(1800);

  const handleSyncData = async () => {
    if (!userId) return;
    await updateDailyMetricScore(userId, 'steps', steps >= 10000);
    await updateDailyMetricScore(userId, 'distance', distance >= 3);
    await updateDailyMetricScore(userId, 'calories', calories >= 2000);
    await updateDailyTotal(userId);
  };

  useEffect(() => {
    // Possibly fetch from Apple/Google Health on mount, then set states
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Your Metrics</Text>
        
        <MetricCard
          title="Steps"
          value={steps}
          goal={10000}
          points={steps >= 10000 ? 25 : 0}
          unit="steps"
        />
        <MetricCard
          title="Distance"
          value={distance}
          goal={3}
          points={distance >= 3 ? 25 : 0}
          unit="miles"
        />
        <MetricCard
          title="Calories"
          value={calories}
          goal={2000}
          points={calories >= 2000 ? 25 : 0}
          unit="kcal"
        />
        
        {/* Sync button */}
        <Button title="Sync and Update Scores" onPress={handleSyncData} />
      </View>
    </ScrollView>
  );
}