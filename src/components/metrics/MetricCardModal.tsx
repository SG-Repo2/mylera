import React, { useCallback, useEffect } from 'react';
import { View, Animated, Pressable } from 'react-native';
import { Modal, Portal, Text, IconButton, useTheme, Surface, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useStyles } from '@/src/styles/useMetricModalStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MetricType } from '@/src/types/metrics';
import { healthMetrics } from '@/src/config/healthMetrics';
import { metricColors } from '@/src/styles/useMetricCardListStyles';
import { BarChart } from './BarChart';

interface MetricModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: string | number;
  data?: {
    labels: string[];
    values: number[];
    startDate?: Date;
  };
  additionalInfo?: {
    label: string;
    value: string | number;
  }[];
  metricType: MetricType;
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
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const translateY = React.useRef(new Animated.Value(200)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const healthTip = getHealthTip(metricType);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 200,
        useNativeDriver: true,
        damping: 15,
        mass: 1,
        stiffness: 150,
      }),
      Animated.spring(opacity, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [onClose, translateY, opacity]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 15,
          mass: 1,
          stiffness: 150,
        }),
        Animated.spring(opacity, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(200);
      opacity.setValue(0);
    }
  }, [visible, translateY, opacity]);

  const metricConfig = healthMetrics[metricType];
  const metricColor = metricColors[metricType];

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleClose}
        contentContainerStyle={[
          styles.modalContainer,
          { paddingBottom: insets.bottom },
        ]}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleClose}>
          <View style={{ flex: 1 }} />
        </Pressable>
        <Animated.View
          style={[
            { transform: [{ translateY }] },
            { opacity },
          ]}
        >
              <Surface style={styles.modalContent} elevation={4}>
                <IconButton
                  icon="close"
                  size={24}
                  onPress={handleClose}
                  style={styles.closeButton}
                />

                <Text variant="headlineMedium" style={styles.modalTitle}>{title}</Text>
                <Text variant="displayMedium" style={[styles.modalValue, { color: metricColor }]}>
                  {metricConfig.formatValue(value)} {metricConfig.displayUnit}
                </Text>

                <View style={styles.chartContainer}>
                  <BarChart metricType={metricType} />
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

                <Card style={styles.healthTipCard}>
                  <Card.Content style={styles.healthTipContent}>
                    <View style={styles.healthTipHeader}>
                      <MaterialCommunityIcons name={healthTip.icon} size={24} color={metricColor} />
                      <Text variant="titleMedium" style={[styles.healthTipTitle, { color: theme.colors.primary }]}>
                        Did you know?
                      </Text>
                    </View>
                    <Text variant="bodyMedium" style={styles.healthTipText}>
                      {healthTip.tip}
                    </Text>
                  </Card.Content>
                </Card>
              </Surface>
            </Animated.View>

      </Modal>
    </Portal>
  );
};
