import React, { useMemo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Text, useTheme, Surface, TouchableRipple, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { healthMetrics } from '@/src/config/healthMetrics';
import { MetricType } from '@/src/types/metrics';
import { useMetricCardStyles } from '@/src/styles/useMetricCardStyles';
import { useAuth } from '@/src/providers/AuthProvider';
import { DISPLAY_UNITS, MeasurementSystem } from '@/src/utils/unitConversion';
import { theme } from '@/src/theme/theme';

interface MetricCardProps {
  title: string;
  value: number | null;
  goal: number;
  points: number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  unit: string;
  metricType: MetricType;
  color?: string;
  onPress: () => void;
  showAlert?: boolean;
  measurementSystem?: MeasurementSystem;
}

const calculateProgress = (value: number | null, goal: number): number => {
  return Math.min((value ?? 0) / goal, 1);
};

export const MetricCard = React.memo(function MetricCard({
  title,
  value,
  goal,
  points,
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
  
  const progress = useMemo(() => calculateProgress(value, goal), [value, goal]);
  const formattedValue = healthMetrics[metricType].formatValue(value ?? 0, measurementSystem);
  const displayUnit = DISPLAY_UNITS[metricType][measurementSystem];
  const percentage = Math.round(progress * 100);
  
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: progress,
      useNativeDriver: false,
      damping: 15,
      mass: 0.8,
      stiffness: 150,
    }).start();
  }, [progress]);

  const handlePressIn = React.useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        stiffness: 200,
        damping: 15,
        mass: 0.8,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
  }, [scaleAnim, glowAnim]);

  const handlePressOut = React.useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 200,
        damping: 15,
        mass: 0.8,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
  }, [scaleAnim, glowAnim]);

  const getPointsText = () => {
    if (metricType === 'heart_rate') {
      return '(zone)';
    }
    const increment = healthMetrics[metricType].pointIncrement.value;
    if (increment === 1) {
      return '(1 per)';
    }
    if (increment < 1) {
      return `(${Math.round(1/increment)} per)`;
    }
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
            outputRange: [0.08, 0.25]
          }),
          shadowColor: color,
          shadowOffset: { width: 0, height: 3 },
          shadowRadius: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [8, 12]
          }),
        }
      ]}
    >
      <Surface 
        style={[
          styles.cardShadowWrapper, 
          { backgroundColor: theme.colors.surface }
        ]} 
        elevation={2}
      >
        <View style={styles.cardContentWrapper}>
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
                  style={[
                    styles.iconContainer, 
                    { 
                      backgroundColor: color,
                      shadowColor: color,
                    }
                  ]} 
                  elevation={4}
                >
                  <MaterialCommunityIcons 
                    name={icon} 
                    size={26} 
                    color="white"
                    style={styles.icon}
                  />
                </Surface>
                <Text 
                  variant="titleMedium" 
                  style={[styles.title, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              </View>
              
              <View style={styles.valueContainer}>
                <Text 
                  variant="displaySmall" 
                  style={[styles.value, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formattedValue}
                </Text>
                <Text 
                  variant="labelMedium" 
                  style={[styles.unit, { color: theme.colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {displayUnit}
                </Text>
              </View>

              <View style={styles.progressContainer}>
                <Animated.View style={styles.progressBar}>
                  <Animated.View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      backgroundColor: color,
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                      borderRadius: 3,
                      opacity: 0.9,
                    }}
                  />
                </Animated.View>
                <View style={styles.progressInfo}>
                  <Text 
                    variant="labelSmall" 
                    style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]} 
                    numberOfLines={1}
                  >
                    {percentage}% of goal
                  </Text>
                  <Text 
                    variant="labelSmall" 
                    style={[styles.pointsText, { color: theme.colors.onSurfaceVariant }]} 
                    numberOfLines={1}
                  >
                    {points} pts {getPointsText()}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableRipple>
        </View>
      </Surface>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  cardWrapper: {
    minHeight: 160,
    aspectRatio: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
  },
  cardShadowWrapper: {
    borderRadius: 24,
    height: '100%',
    backgroundColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContentWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    height: '100%',
    backgroundColor: theme.colors.surface,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  icon: {
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 3,
    marginBottom: 4,
  },
  ripple: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
    height: '100%',
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
    gap: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
    letterSpacing: 0.25,
  },
  progressContainer: {
    gap: 2,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  pointsText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
});
