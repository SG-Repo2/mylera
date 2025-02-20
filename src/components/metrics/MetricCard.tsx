import React, { useMemo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Text, useTheme, Surface, TouchableRipple } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { healthMetrics } from '@/src/config/healthMetrics';
import { MetricType } from '@/src/types/metrics';
import { MetricScore } from '@/src/utils/scoringUtils';
import { useMetricCardStyles } from '@/src/styles/useMetricCardStyles';
import { useAuth } from '@/src/providers/AuthProvider';
import { DISPLAY_UNITS, MeasurementSystem } from '@/src/utils/unitConversion';

interface MetricCardProps {
  title: string;
  score: MetricScore;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  unit: string;
  metricType: MetricType;
  color?: string;
  onPress: () => void;
  showAlert?: boolean;
  measurementSystem?: MeasurementSystem;
}

const calculateProgress = (value: number, goal: number): number => {
  return Math.min(value / goal, 1);
};

export const MetricCard = React.memo(function MetricCard({
  title,
  score,
  icon,
  unit,
  metricType,
  color,
  onPress,
  showAlert,
  measurementSystem: propMeasurementSystem
}: MetricCardProps) {
  const styles = useMetricCardStyles();
  const theme = useTheme();
  const { user } = useAuth();
  const measurementSystem = propMeasurementSystem || (user?.user_metadata?.measurementSystem || 'metric') as MeasurementSystem;
  
  const progress = useMemo(() => calculateProgress(score.value, score.goal), [score.value, score.goal]);
  const formattedValue = healthMetrics[metricType].formatValue(score.value, measurementSystem);
  const displayUnit = DISPLAY_UNITS[metricType][measurementSystem];
  const percentage = Math.round(progress * 100);
  
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: progress,
      useNativeDriver: false,
      damping: 20,
      mass: 0.7,
      stiffness: 180,
    }).start();
  }, [progress]);

  const handlePressIn = React.useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
        stiffness: 250,
        damping: 18,
        mass: 0.7,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start();
  }, [scaleAnim, glowAnim]);

  const handlePressOut = React.useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 250,
        damping: 18,
        mass: 0.7,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
  }, [scaleAnim, glowAnim]);

  const getPointsText = () => {
    if (metricType === 'heart_rate') return '(zone)';
    const increment = healthMetrics[metricType].pointIncrement.value;
    if (increment === 1) return '(1 per)';
    if (increment < 1) return `(${Math.round(1/increment)} per)`;
    return `(1 per ${increment})`;
  };

  return (
    <Animated.View 
      style={[
        styles.cardWrapper,
        {
          transform: [{ scale: scaleAnim }],
          shadowOpacity: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.06, 0.18]
          }),
          shadowColor: color,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [6, 10]
          }),
        }
      ]}
    >
      <Surface style={[styles.cardSurface]} elevation={1}>
        <TouchableRipple
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.ripple}
          borderless
        >
          <View style={styles.cardContent}>
            <View style={styles.headerRow}>
              <Surface 
                style={[styles.iconContainer, { backgroundColor: color }]} 
                elevation={2}
              >
                <MaterialCommunityIcons 
                  name={icon} 
                  size={22} 
                  color="white"
                  style={styles.icon}
                />
              </Surface>
              <Text 
                variant="titleMedium" 
                style={styles.title}
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
            
            <View style={styles.valueContainer}>
              <Text 
                variant="displaySmall" 
                style={styles.value}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formattedValue}
              </Text>
              <Text 
                variant="labelMedium" 
                style={styles.unit}
                numberOfLines={1}
              >
                {displayUnit}
              </Text>
            </View>

            <View style={styles.progressContainer}>
              <Animated.View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: color,
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    }
                  ]}
                />
              </Animated.View>
              <View style={styles.progressInfo}>
                <Text variant="labelSmall" style={styles.pointsText}>
                  {score.points} pts {getPointsText()}
                </Text>
              </View>
            </View>
          </View>
        </TouchableRipple>
      </Surface>
    </Animated.View>
  );
});

export default MetricCard;
