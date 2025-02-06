import React, { useCallback, useEffect, useState } from 'react';
import { View, Animated, Pressable, ScrollView, Easing } from 'react-native';
import { Modal, Portal, Text, IconButton, useTheme, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { brandColors } from '@/src/theme/theme';
import { useStyles } from '@/src/styles/useMetricModalStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MetricType } from '@/src/types/metrics';
import { healthMetrics } from '@/src/config/healthMetrics';
import { metricColors } from '@/src/styles/useMetricCardListStyles';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { BarChart } from './BarChart';

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

const getHealthTip = (metricType: MetricType): HealthTip => {
  const tips: Record<MetricType, HealthTip> = {
    steps: {
      tip: "Walking 10,000 steps a day can improve cardiovascular health and help maintain a healthy weight. Try taking the stairs instead of the elevator!",
      icon: "walk"
    },
    distance: {
      tip: "Regular walking or running can strengthen your bones and reduce the risk of osteoporosis. Start with small distances and gradually increase!",
      icon: "run"
    },
    calories: {
      tip: "A healthy calorie deficit of 500-750 calories per day can lead to sustainable weight loss of 1-1.5 pounds per week.",
      icon: "fire"
    },
    exercise: {
      tip: "Mix cardio with strength training for optimal health benefits. Aim for at least 150 minutes of moderate activity per week!",
      icon: "weight-lifter"
    },
    heart_rate: {
      tip: "Your resting heart rate is a good indicator of your cardiovascular fitness. A lower resting heart rate often means better cardiovascular health!",
      icon: "heart-pulse"
    },
    basal_calories: {
      tip: "Your basal metabolic rate accounts for about 60-75% of your daily calorie burn. Stay hydrated and get enough sleep to maintain a healthy metabolism!",
      icon: "lightning-bolt"
    },
    flights_climbed: {
      tip: "Taking the stairs is a great way to incorporate more physical activity into your daily routine. It helps strengthen your legs and improve endurance!",
      icon: "stairs"
    }
  };
  return tips[metricType];
};

export const MetricModal: React.FC<MetricModalProps> = ({
  visible,
  onClose,
  title,
  value,
  additionalInfo,
  metricType,
  userId,
  date,
  provider,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const [isLoading, setIsLoading] = useState(true);
  const [trend, setTrend] = useState<{ direction: 'up' | 'down' | 'neutral', percentage: number } | null>(null);
  
  const translateY = React.useRef(new Animated.Value(500)).current;
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;
  const contentOpacity = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.95)).current;
  const valueScale = React.useRef(new Animated.Value(1)).current;
  const healthTip = getHealthTip(metricType);

  // Simulate loading and trend calculation
  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      // Simulate API call delay
      setTimeout(() => {
        setTrend({
          direction: Math.random() > 0.5 ? 'up' : 'down',
          percentage: Math.round(Math.random() * 20)
        });
        setIsLoading(false);
      }, 1000);
    }
  }, [visible]);

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
    Animated.sequence([
      // First fade in backdrop
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      // Then animate content with parallel animations
      Animated.parallel([
        // Slide up with overshoot
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 12,
          mass: 0.8,
          stiffness: 180,
        }),
        // Scale up with slight overshoot
        Animated.sequence([
          Animated.spring(scale, {
            toValue: 1.02,
            useNativeDriver: true,
            damping: 10,
            mass: 0.8,
            stiffness: 180,
          }),
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            damping: 12,
            mass: 0.8,
            stiffness: 180,
          }),
        ]),
        // Fade in content slightly delayed
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 300,
          delay: 150,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
    ]).start();
  }, [backdropOpacity, translateY, scale, contentOpacity]);

  const animateOut = useCallback(() => {
    Animated.sequence([
      // First animate content
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.in(Easing.cubic),
        }),
        Animated.spring(translateY, {
          toValue: 100,
          useNativeDriver: true,
          damping: 12,
          mass: 0.8,
          stiffness: 180,
        }),
        Animated.spring(scale, {
          toValue: 0.95,
          useNativeDriver: true,
          damping: 10,
          mass: 0.8,
          stiffness: 180,
        }),
      ]),
      // Then fade out backdrop
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
    ]).start(() => {
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

  const metricConfig = healthMetrics[metricType];
  const metricColor = metricColors[metricType];

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
        <Animated.View 
          style={[
            styles.modalBackdrop,
            { opacity: backdropOpacity }
          ]}
        >
          <Pressable 
            style={{ flex: 1 }} 
            onPress={handleClose}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [
                { translateY },
                { scale }
              ],
              opacity: contentOpacity,
              shadowOpacity: contentOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.15],
              }),
              shadowColor: theme.colors.shadow,
              shadowOffset: { width: 0, height: -2 },
              shadowRadius: 12,
            }
          ]}
        >
          <ScrollView 
            style={{ width: '100%' }} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <IconButton
              icon="close"
              size={24}
              onPress={handleClose}
              style={styles.closeButton}
            />

            <View>
              <Text variant="headlineMedium" style={styles.modalTitle}>{title}</Text>
              <View style={styles.valueContainer}>
                <Animated.View style={{ transform: [{ scale: valueScale }] }}>
                  <Text variant="displayMedium" style={[styles.modalValue, { color: metricColor }]}>
                    {metricConfig.formatValue(value)} {metricConfig.displayUnit}
                  </Text>
                </Animated.View>
                {!isLoading && trend && (
                  <View style={styles.trendContainer}>
                    <MaterialCommunityIcons
                      name={trend.direction === 'up' ? 'trending-up' : 'trending-down'}
                      size={20}
                      color={trend.direction === 'up' ? brandColors.primary : theme.colors.error}
                    />
                    <Text style={[
                      styles.trendText,
                      trend.direction === 'up' ? styles.trendUp : styles.trendDown
                    ]}>
                      {trend.percentage}%
                    </Text>
                  </View>
                )}
              </View>

              <Card style={styles.healthTipCard}>
                <Card.Content style={styles.healthTipContent}>
                  <Animated.View style={[
                    styles.healthTipGlow,
                    {
                      opacity: contentOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 0.08]
                      })
                    }
                  ]} />
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
                    <Text variant="titleMedium" style={[styles.healthTipTitle, { color: theme.colors.primary }]}>
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
                />
              )}
            </View>

            {additionalInfo && additionalInfo.length > 0 && (
              <View style={styles.additionalInfoContainer}>
                {additionalInfo.map((info, index) => (
                  <View key={index} style={styles.infoRow}>
                    <Text variant="bodyLarge" style={styles.infoLabel}>{info.label}</Text>
                    <Text variant="titleMedium" style={styles.infoValue}>{info.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Modal>
    </Portal>
  );
};
