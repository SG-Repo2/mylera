import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Animated, Pressable, ScrollView, Easing } from 'react-native';
import {
  Modal,
  Portal,
  Text,
  IconButton,
  useTheme,
  Card,
  ActivityIndicator,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { brandColors } from '@/src/theme/theme';
import { useStyles } from '@/src/styles/useMetricModalStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MetricType } from '@/src/types/metrics';
import { healthMetrics } from '@/src/config/healthMetrics';
import { metricColors } from '@/src/styles/useMetricCardListStyles';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { BarChart } from './BarChart';
import { useAuth } from '@/src/providers/auth';
import { MeasurementSystem, DISPLAY_UNITS, formatMetricValue } from '@/src/utils/unitConversion';

interface MetricModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: string | number;
  additionalInfo?: {
    label: string;
    value: string | number;
  }[];
  metricType: MetricType;
  userId: string;
  date: string;
  provider: HealthProvider;
}

interface HealthTip {
  tip: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

interface TrendData {
  direction: 'up' | 'down' | 'neutral';
  percentage: number;
}

const getHealthTip = (metricType: MetricType): HealthTip => {
  const tips: Record<MetricType, HealthTip> = {
    steps: {
      tip: 'Walking 10,000 steps a day can improve cardiovascular health and help maintain a healthy weight. Try taking the stairs instead of the elevator!',
      icon: 'walk',
    },
    distance: {
      tip: 'Regular walking or running can strengthen your bones and reduce the risk of osteoporosis. Start with small distances and gradually increase!',
      icon: 'run',
    },
    calories: {
      tip: 'A healthy calorie deficit of 500-750 calories per day can lead to sustainable weight loss of 1-1.5 pounds per week.',
      icon: 'fire',
    },
    exercise: {
      tip: 'Mix cardio with strength training for optimal health benefits. Aim for at least 150 minutes of moderate activity per week!',
      icon: 'weight-lifter',
    },
    heart_rate: {
      tip: 'Your resting heart rate is a good indicator of your cardiovascular fitness. A lower resting heart rate often means better cardiovascular health!',
      icon: 'heart-pulse',
    },
    basal_calories: {
      tip: 'Your basal metabolic rate accounts for about 60-75% of your daily calorie burn. Stay hydrated and get enough sleep to maintain a healthy metabolism!',
      icon: 'lightning-bolt',
    },
    flights_climbed: {
      tip: 'Taking the stairs is a great way to incorporate more physical activity into your daily routine. It helps strengthen your legs and improve endurance!',
      icon: 'stairs',
    },
  };
  return tips[metricType];
};

// Group metrics by day and calculate daily totals
const groupMetricsByDay = (metrics: any[]): Record<string, number> => {
  const dailyTotals: Record<string, number> = {};

  metrics.forEach(metric => {
    const date = new Date(metric.timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format

    if (!dailyTotals[dateStr]) {
      dailyTotals[dateStr] = 0;
    }

    dailyTotals[dateStr] += metric.value;
  });

  return dailyTotals;
};

// Calculate trend by comparing current value with historical data
const calculateTrend = async (
  provider: HealthProvider,
  metricType: MetricType,
  currentValue: number
): Promise<TrendData> => {
  try {
    // Get current date and date range for the past 7 days (excluding today)
    const today = new Date();
    const endDateTime = new Date(today);
    endDateTime.setDate(endDateTime.getDate() - 1); // Yesterday

    const startDateTime = new Date(today);
    startDateTime.setDate(startDateTime.getDate() - 7); // 7 days ago

    console.log(
      `[calculateTrend] Fetching data from ${startDateTime.toISOString()} to ${endDateTime.toISOString()}`
    );

    // Fetch historical data
    const rawData = await provider.fetchRawMetrics(startDateTime, endDateTime, [metricType]);

    // Normalize the data
    const normalizedData = provider.normalizeMetrics(rawData, metricType);
    console.log(`[calculateTrend] Found ${normalizedData.length} metrics for trend calculation`);

    if (normalizedData.length === 0) {
      console.log('[calculateTrend] No historical data found, returning neutral trend');
      return { direction: 'neutral', percentage: 0 };
    }

    // Group metrics by day to get daily totals
    const dailyTotals = groupMetricsByDay(normalizedData);
    const dailyValues = Object.values(dailyTotals);
    console.log(`[calculateTrend] Daily totals: ${JSON.stringify(dailyTotals)}`);

    if (dailyValues.length === 0) {
      console.log('[calculateTrend] No daily values after grouping, returning neutral trend');
      return { direction: 'neutral', percentage: 0 };
    }

    // Calculate average of previous days
    const totalValue = dailyValues.reduce((sum, value) => sum + value, 0);
    const avgValue = totalValue / dailyValues.length;
    console.log(`[calculateTrend] Average value from historical data: ${avgValue}`);

    // Skip if average is zero to avoid division by zero
    if (avgValue === 0) {
      console.log('[calculateTrend] Average is zero, returning neutral trend');
      return { direction: 'neutral', percentage: 0 };
    }

    // Calculate percentage change
    const percentChange = ((currentValue - avgValue) / avgValue) * 100;
    console.log(
      `[calculateTrend] Current value: ${currentValue}, Percent change: ${percentChange.toFixed(2)}%`
    );

    // Determine trend direction
    let direction: 'up' | 'down' | 'neutral';
    if (Math.abs(percentChange) < 5) {
      direction = 'neutral';
    } else {
      direction = percentChange > 0 ? 'up' : 'down';
    }

    return {
      direction,
      percentage: Math.abs(Math.round(percentChange)),
    };
  } catch (error) {
    console.error('[calculateTrend] Error calculating trend:', error);
    return { direction: 'neutral', percentage: 0 };
  }
};

export const MetricModal: React.FC<MetricModalProps> = React.memo(
  ({ visible, onClose, title, value, additionalInfo, metricType, userId, date, provider }) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useStyles();
    const { user } = useAuth();
    const measurementSystem = (user?.user_metadata?.measurementSystem ||
      'metric') as MeasurementSystem;
    const [isLoading, setIsLoading] = useState(true);
    const [trend, setTrend] = useState<TrendData | null>(null);

    const translateY = React.useRef(new Animated.Value(500)).current;
    const backdropOpacity = React.useRef(new Animated.Value(0)).current;
    const contentOpacity = React.useRef(new Animated.Value(0)).current;
    const scale = React.useRef(new Animated.Value(0.95)).current;
    const valueScale = React.useRef(new Animated.Value(1)).current;
    const healthTip = useMemo(() => getHealthTip(metricType), [metricType]);

    // Memoize config values
    const metricConfig = useMemo(() => healthMetrics[metricType], [metricType]);
    const metricColor = useMemo(() => metricColors[metricType], [metricType]);
    const displayUnit = useMemo(
      () => DISPLAY_UNITS[metricType][measurementSystem],
      [metricType, measurementSystem]
    );

    // Memoize formatted goal
    const formattedGoal = useMemo(
      () => formatMetricValue(metricConfig.defaultGoal, metricType, measurementSystem),
      [metricConfig.defaultGoal, metricType, measurementSystem]
    );

    // Effect with cleanup for loading and trend calculation
    useEffect(() => {
      if (visible) {
        setIsLoading(true);

        const fetchTrend = async () => {
          try {
            // Initialize provider if needed
            await provider.initialize();

            // Calculate trend based on historical data
            const numericValue = typeof value === 'string' ? parseFloat(value) : value;
            console.log(
              `[MetricCardModal] Calculating trend for ${metricType} with current value: ${numericValue}`
            );

            const trendData = await calculateTrend(provider, metricType, numericValue);
            console.log(
              `[MetricCardModal] Trend calculated: ${trendData.direction} ${trendData.percentage}%`
            );

            setTrend(trendData);
            setIsLoading(false);
          } catch (error) {
            console.error('[MetricCardModal] Error fetching trend data:', error);
            setTrend({ direction: 'neutral', percentage: 0 });
            setIsLoading(false);
          }
        };

        fetchTrend();

        return () => {
          // Cleanup if needed
        };
      }
    }, [visible, provider, metricType, value]);

    // Enhanced pulse animation for the value
    const pulseValue = useCallback(() => {
      Animated.sequence([
        Animated.spring(valueScale, {
          toValue: 1.08,
          useNativeDriver: true,
          damping: 10,
          mass: 0.8,
          stiffness: 150,
        }),
        Animated.spring(valueScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 12,
          mass: 0.8,
          stiffness: 150,
        }),
      ]).start();
    }, [valueScale]);

    useEffect(() => {
      if (!isLoading) {
        pulseValue();
      }
    }, [isLoading, pulseValue]);

    const animateIn = useCallback(() => {
      // Reset animation values to starting positions
      translateY.setValue(500);
      backdropOpacity.setValue(0);
      contentOpacity.setValue(0);
      scale.setValue(0.95);

      Animated.sequence([
        // First fade in backdrop with smoother easing
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        // Then animate content with coordinated parallel animations
        Animated.parallel([
          // Slide up with refined spring physics
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 14, // Increased damping for less bouncy, more professional feel
            mass: 0.7, // Reduced mass for faster initial movement
            stiffness: 200, // Balanced stiffness for natural motion
            restDisplacementThreshold: 0.01, // Better stopping behavior
            restSpeedThreshold: 0.01, // Better stopping behavior
          }),
          // Scale up with subtle overshoot
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            damping: 15,
            mass: 0.8,
            stiffness: 160,
            restDisplacementThreshold: 0.01,
            restSpeedThreshold: 0.01,
          }),
          // Fade in content with slight delay for sequenced feel
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 280,
            delay: 100, // Slight delay for better sequenced feel
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]),
      ]).start();
    }, [backdropOpacity, translateY, scale, contentOpacity]);

    const animateOut = useCallback(() => {
      Animated.parallel([
        // Fade out content quickly
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        // Slide down slightly
        Animated.timing(translateY, {
          toValue: 50, // Less movement on exit for subtlety
          duration: 180,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        // Scale down slightly
        Animated.timing(scale, {
          toValue: 0.97,
          duration: 180,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        // Fade out backdrop
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220, // Slightly longer for smooth exit
          useNativeDriver: true,
          easing: Easing.in(Easing.cubic),
        }),
      ]).start(() => {
        // Reset values for next entrance
        translateY.setValue(500);
        scale.setValue(0.95);
        onClose();
      });
    }, [backdropOpacity, translateY, scale, contentOpacity, onClose]);

    const handleClose = useCallback(() => {
      animateOut();
    }, [animateOut]);

    useEffect(() => {
      if (visible) {
        animateIn();
      }
    }, [visible, animateIn]);

    return (
      <Portal>
        <Modal
          visible={visible}
          onDismiss={handleClose}
          contentContainerStyle={[
            styles.modalContainer,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <Animated.View style={[styles.modalBackdrop, { opacity: backdropOpacity }]}>
            <Pressable style={{ flex: 1 }} onPress={handleClose} />
          </Animated.View>
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ translateY }, { scale }],
                opacity: contentOpacity,
                shadowOpacity: contentOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.15],
                }),
                shadowColor: theme.colors.shadow,
                shadowOffset: { width: 0, height: -2 },
                shadowRadius: 12,
              },
            ]}
          >
            <ScrollView
              style={{ width: '100%' }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <IconButton icon="close" size={24} onPress={handleClose} style={styles.closeButton} />

              <View>
                <Text variant="headlineMedium" style={styles.modalTitle}>
                  {title}
                </Text>
                <View style={styles.valueContainer}>
                  <Animated.View style={{ transform: [{ scale: valueScale }] }}>
                    <Text
                      variant="displayMedium"
                      style={[styles.modalValue, { color: metricColor }]}
                    >
                      {
                        metricConfig.formatValue(
                          typeof value === 'string' ? parseFloat(value) : value,
                          measurementSystem
                        ).value
                      }{' '}
                      {displayUnit}
                    </Text>
                  </Animated.View>
                  {!isLoading && trend && (
                    <View style={styles.trendContainer}>
                      <MaterialCommunityIcons
                        name={
                          trend.direction === 'up'
                            ? 'trending-up'
                            : trend.direction === 'down'
                              ? 'trending-down'
                              : 'trending-neutral'
                        }
                        size={20}
                        color={
                          trend.direction === 'up'
                            ? brandColors.primary
                            : trend.direction === 'down'
                              ? theme.colors.error
                              : theme.colors.onSurfaceVariant
                        }
                      />
                      <Text
                        style={[
                          styles.trendText,
                          trend.direction === 'up'
                            ? styles.trendUp
                            : trend.direction === 'down'
                              ? styles.trendDown
                              : styles.trendNeutral,
                        ]}
                      >
                        {trend.percentage > 0 ? `${trend.percentage}%` : 'No change'}
                      </Text>
                    </View>
                  )}
                </View>

                <Card style={styles.healthTipCard}>
                  <Card.Content style={styles.healthTipContent}>
                    <Animated.View
                      style={[
                        styles.healthTipGlow,
                        {
                          opacity: contentOpacity.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 0.08],
                          }),
                        },
                      ]}
                    />
                    <View style={styles.healthTipHeader}>
                      <MaterialCommunityIcons
                        name={healthTip.icon}
                        size={24}
                        color={metricColor}
                        style={{
                          transform: [{ scale: 1.1 }],
                          textShadowColor: metricColor,
                          textShadowOffset: { width: 0, height: 0 },
                          textShadowRadius: 8,
                        }}
                      />
                      <Text
                        variant="titleMedium"
                        style={[styles.healthTipTitle, { color: theme.colors.primary }]}
                      >
                        Did you know?
                      </Text>
                    </View>
                    <Text variant="bodyMedium" style={styles.healthTipText}>
                      {healthTip.tip}
                    </Text>
                  </Card.Content>
                </Card>
              </View>

              <View style={[styles.chartContainer, { marginTop: 0 }]}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={metricColor} />
                    <Text style={styles.loadingText}>Loading historical data...</Text>
                  </View>
                ) : (
                  <BarChart
                    metricType={metricType}
                    userId={userId}
                    date={date}
                    provider={provider}
                    measurementSystem={measurementSystem}
                  />
                )}
              </View>

              {additionalInfo && additionalInfo.length > 0 && (
                <View style={styles.additionalInfoContainer}>
                  {additionalInfo.map((info, index) => {
                    // Format goal value if this is the goal info
                    const displayValue =
                      info.label === 'Daily Goal'
                        ? `${formattedGoal.value} ${displayUnit}`
                        : info.value;

                    return (
                      <View key={index} style={styles.infoRow}>
                        <Text variant="bodyLarge" style={styles.infoLabel}>
                          {info.label}
                        </Text>
                        <Text variant="titleMedium" style={styles.infoValue}>
                          {displayValue}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Modal>
      </Portal>
    );
  }
);
