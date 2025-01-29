import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import type { MetricType } from '@/src/types/metrics';
import type { HealthMetrics } from '@/src/providers/health/types/metrics';

interface MetricChartProps {
  type: MetricType;
  data: HealthMetrics[];
  timeframe?: 'daily' | 'weekly' | 'monthly';
}

const CHART_HEIGHT = 220;
const screenWidth = Dimensions.get('window').width;

export function MetricChart({ type, data, timeframe = 'daily' }: MetricChartProps) {
  const chartData = useMemo(() => {
    const sortedData = [...data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return {
      labels: sortedData.map(d => {
        const date = new Date(d.date);
        return timeframe === 'daily' 
          ? date.getHours().toString() 
          : date.getDate().toString();
      }),
      datasets: [{
        data: sortedData.map(d => d[type] || 0),
        color: (opacity = 1) => `rgba(75, 158, 255, ${opacity})`,
        strokeWidth: 2
      }]
    };
  }, [data, type, timeframe]);

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(75, 158, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#4B9EFF'
    }
  };

  if (!data.length) {
    return (
      <View style={styles.noDataContainer}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Trend
      </Text>
      <LineChart
        data={chartData}
        width={screenWidth - 32}
        height={CHART_HEIGHT}
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noDataContainer: {
    height: CHART_HEIGHT,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#6B7280',
  },
});