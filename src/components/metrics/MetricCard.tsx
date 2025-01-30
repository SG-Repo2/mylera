import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { healthMetrics } from '@/src/config/healthMetrics';
import { MetricType } from '@/src/types/metrics';
import { theme } from '@/src/theme/theme';

interface MetricCardProps {
  title: string;
  value: number;
  goal: number;
  points: number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  unit: string;
  metricType: MetricType;
  color?: string;
  onPress?: () => void;
  showAlert?: boolean;
}

interface MetricDetailCardProps {
  metricType: MetricType;
  value: number;
  goal: number;
  color?: string;
}

const calculateProgress = (value: number, goal: number): number => {
  return Math.min(value / goal, 1);
};

export const MetricCard = React.memo(function MetricCard({
  title,
  value,
  goal,
  points,
  icon,
  unit,
  metricType,
  color = theme.colors.primary,
  onPress
}: MetricCardProps) {
  const theme = useTheme();
  const progress = useMemo(() => calculateProgress(value, goal), [value, goal]);
  const formattedValue = healthMetrics[metricType].formatValue(value);
  const percentage = Math.round(progress * 100);

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} onPress={onPress}>
      <Card.Content style={styles.cardContent}>
        {/* Top Row */}
        <View style={styles.topRow}>
          {/* Value Display */}
          <View style={styles.valueContainer}>
            <Text variant="titleLarge" style={[styles.value, { color: theme.colors.onSurface }]}>
              {formattedValue}
            </Text>
            <Text variant="labelSmall" style={[styles.unit, { color: theme.colors.onSurfaceVariant }]}>
              {unit}
            </Text>
          </View>
          
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: color }]}>
            <MaterialCommunityIcons
              name={icon}
              size={20}
              color={theme.colors.surface}
            />
          </View>
        </View>

        {/* Center - Metric Name */}
        <View style={styles.centerContainer}>
          <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
        </View>

        {/* Bottom - Progress */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: `${color}20` }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: color,
                  width: `${percentage}%` 
                }
              ]} 
            />
          </View>
          <Text variant="labelSmall" style={[styles.progressText, { color }]}>
            {percentage}% of goal
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
});

export const MetricDetailCard = React.memo(function MetricDetailCard({
  metricType,
  value,
  goal,
  color,
}: MetricDetailCardProps) {
  const theme = useTheme();
  const config = healthMetrics[metricType];
  const progress = useMemo(() => calculateProgress(value, goal), [value, goal]);
  const formattedValue = config.formatValue(value);
  const percentage = Math.round(progress * 100);
  
  return (
    <Card style={[styles.detailCard, { backgroundColor: theme.colors.surface }]}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.valueContainer}>
          <Text variant="headlineLarge" style={[styles.value, { color: theme.colors.onSurface }]}>
            {formattedValue}
          </Text>
          <Text variant="titleSmall" style={[styles.unit, { color: theme.colors.onSurfaceVariant }]}>
            {config.displayUnit}
          </Text>
        </View>

        <View style={[styles.progressBar, { backgroundColor: `${color}20` }]}>
          <View 
            style={[
              styles.progressFill, 
              { 
                backgroundColor: color || theme.colors.primary,
                width: `${percentage}%` 
              }
            ]} 
          />
        </View>

        <Text variant="bodySmall" style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
          {percentage}% of {goal} {config.displayUnit}
        </Text>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    marginVertical: 6,
    marginHorizontal: 6,
    elevation: 2,
    borderRadius: theme.roundness * 2,
    minHeight: 120,
  },
  cardContent: {
    padding: 10,
    height: '100%',
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    paddingRight: 8,
  },
  value: {
    fontWeight: '700',
    marginRight: 4,
    fontSize: 20,
  },
  unit: {
    fontWeight: '500',
    fontSize: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  title: {
    fontWeight: '600',
    fontSize: 14,
  },
  progressContainer: {
    width: '100%',
    marginTop: 'auto',
  },
  progressBar: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  progressText: {
    textAlign: 'right',
    fontWeight: '500',
    fontSize: 10,
  },
  detailCard: {
    marginVertical: 16,
    marginHorizontal: 16,
    elevation: 2,
    borderRadius: theme.roundness * 2,
  }
});
