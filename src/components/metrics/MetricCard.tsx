import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MaterialCommunityIcons as IconType } from '@expo/vector-icons';
import type { MetricType } from '@/src/types/metrics';

interface MetricCardProps {
  title: string;
  value: number;
  points: number;
  goal: number;
  unit: string;
  icon: keyof typeof IconType.glyphMap;
  progress: number;
  color: string;
  showAlert?: boolean;
  onPress?: () => void;
  style?: any;
}

const COLORS = {
  primary: '#40C9A2',
  'metric-red': '#FF7B7B',
  accent: '#A66BFF',
  secondary: '#4B9EFF',
  default: '#6B7280',
};

export function MetricCard({
  title,
  value,
  points,
  goal,
  unit,
  icon,
  progress,
  color,
  showAlert,
  onPress,
  style
}: MetricCardProps) {
  const backgroundColor = COLORS[color as keyof typeof COLORS] || COLORS.default;
  const progressPercentage = Math.min(progress * 100, 100);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        { backgroundColor },
        style
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {title}
          </Text>
          <Text style={styles.points}>
            {points} pts
          </Text>
        </View>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={icon}
            size={28}
            color="white"
          />
        </View>
      </View>

      {/* Value and Progress */}
      <View style={styles.content}>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>
            {Math.round(value).toLocaleString()}
          </Text>
          <Text style={styles.unit}>
            {unit}
          </Text>
        </View>

        {/* Progress Bar */}
        <View>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${progressPercentage}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progressPercentage)}% of goal
          </Text>
        </View>

        {/* Alert Indicator */}
        {showAlert && (
          <View style={styles.alertContainer}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={24}
              color="white"
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderRadius: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  points: {
    fontSize: 16,
    color: 'white',
    opacity: 0.7,
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 9999,
    padding: 12,
  },
  content: {
    gap: 16,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  value: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  unit: {
    fontSize: 20,
    color: 'white',
    opacity: 0.8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 9999,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: 'white',
    opacity: 0.7,
  },
  alertContainer: {
    position: 'absolute',
    top: 24,
    right: 24,
  },
});