import React, { useState, useEffect, useCallback } from 'react';
import { View, Dimensions, Platform, Pressable, ScrollView } from 'react-native';
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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { metricsService } from '@/src/services/metricsService';
import { MetricType } from '@/src/types/metrics';
import { healthMetrics } from '@/src/config/healthMetrics';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';
import { formatMetricValue, DISPLAY_UNITS } from '@/src/utils/unitConversion';
import { useAuth } from '@/src/providers/AuthProvider';
import { DateUtils } from '@/src/utils/DateUtils';
import { metricColors } from '@/src/styles/useMetricCardListStyles';
import { useStyles } from '@/src/styles/useMetricModalStyles';
import { BarChart } from './BarChart';
import { HealthProvider } from '@/src/providers/health/types/provider';
import { calculateMetricPoints, MetricScore } from '@/src/utils/scoringUtils';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HistoricalDataPoint {
  date: string;
  value: number;
  formattedDate: string;
  dayOfWeek: string;
  score: MetricScore;
}

interface MetricModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: number;
  metricType: MetricType;
  userId: string;
  date: string;
  provider: HealthProvider;
  additionalInfo?: {
    label: string;
    value: string | number;
  }[];
}

export const MetricModal: React.FC<MetricModalProps> = ({
  visible,
  onClose,
  title,
  value,
  metricType,
  userId,
  date,
  provider,
  additionalInfo = [],
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { user } = useAuth();
  const measurementSystem = user?.user_metadata?.measurementSystem || 'metric';
  const metricConfig = healthMetrics[metricType];
  const metricColor = metricColors[metricType] || theme.colors.primary;
  const goalValue = metricConfig.defaultGoal;
  
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<HistoricalDataPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Animation values
  const modalY = useSharedValue(100);
  const opacity = useSharedValue(0);
  const chartProgress = useSharedValue(0);
  const progressWidth = useSharedValue(0);

  const ensureProviderInitialized = async () => {
    try {
      await provider.initialize();
      await provider.initializePermissions(userId);
    } catch (error) {
      console.error('[MetricModal] Provider initialization failed:', error);
      throw new Error('Failed to initialize health provider');
    }
  };

  const validateAndGetDateRange = (inputDate: string) => {
    try {
      const parsedDate = new Date(inputDate);
      if (isNaN(parsedDate.getTime())) {
        throw new Error('Invalid input date');
      }

      const endDate = new Date(parsedDate);
      endDate.setHours(0, 0, 0, 0);

      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);

      const endDateStr = endDate.toISOString().split('T')[0];
      const startDateStr = startDate.toISOString().split('T')[0];

      console.log('[MetricModal] Date range calculated:', {
        input: inputDate,
        startDate: startDateStr,
        endDate: endDateStr,
      });

      return {
        startDate,
        endDate,
        endDateStr,
        startDateStr
      };
    } catch (error) {
      console.error('[MetricModal] Date validation error:', error);
      throw new Error('Invalid date format');
    }
  };

  const fetchHistoricalData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await ensureProviderInitialized();
      const dateRange = validateAndGetDateRange(date);
      
      const [historicalMetrics, nativeMetrics] = await Promise.all([
        metricsService.getHistoricalMetrics(userId, metricType, dateRange.endDateStr),
        provider.fetchRawMetrics(dateRange.startDate, dateRange.endDate, [metricType])
      ]);
      
      const metricsMap = new Map(
        historicalMetrics.map((item: { date: string; value: number }) => [item.date, item.value])
      );

      const nativeDataMap = new Map<string, number>();
      if (nativeMetrics[metricType]) {
        nativeMetrics[metricType]?.forEach((metric: { startDate: string; value: number }) => {
          const metricDate = new Date(metric.startDate).toISOString().split('T')[0];
          nativeDataMap.set(
            metricDate,
            (nativeDataMap.get(metricDate) || 0) + metric.value
          );
        });
      }
      
      const result: HistoricalDataPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const currentDate = new Date(dateRange.endDate);
        currentDate.setDate(currentDate.getDate() - i);
        const dateStr = currentDate.toISOString().split('T')[0];
        
        const value = nativeDataMap.get(dateStr) || metricsMap.get(dateStr) || 0;
        const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
        const score = calculateMetricPoints(metricType, value, metricConfig);
        
        result.push({
          date: dateStr,
          value,
          formattedDate: currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          dayOfWeek,
          score
        });
      }

      setHistoricalData(result);
      const today = result[result.length - 1];
      setSelectedDay(today);
      
      progressWidth.value = withTiming(
        Math.min((today.value / goalValue) * 100, 100),
        {
          duration: 1000,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        }
      );
    } catch (error) {
      console.error('[MetricModal] Error fetching historical data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load historical data');
      
      try {
        console.log('[MetricModal] Attempting fallback to metrics service only');
        const dateRange = validateAndGetDateRange(date);
        const historicalMetrics = await metricsService.getHistoricalMetrics(
          userId,
          metricType,
          dateRange.endDateStr
        );

        const result: HistoricalDataPoint[] = [];
        for (let i = 6; i >= 0; i--) {
          const currentDate = new Date(dateRange.endDate);
          currentDate.setDate(currentDate.getDate() - i);
          const dateStr = currentDate.toISOString().split('T')[0];
          
          const metricForDate = historicalMetrics.find(m => m.date === dateStr);
          const value = metricForDate?.value || 0;
          const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
          const score = calculateMetricPoints(metricType, value, metricConfig);
          
          result.push({
            date: dateStr,
            value,
            formattedDate: currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            dayOfWeek,
            score
          });
        }
        
        setHistoricalData(result);
        const today = result[result.length - 1];
        setSelectedDay(today);
        
        progressWidth.value = withTiming(
          Math.min((today.value / goalValue) * 100, 100),
          {
            duration: 1000,
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          }
        );
      } catch (fallbackError) {
        console.error('[MetricModal] Fallback data fetch failed:', fallbackError);
        setError('Unable to load historical data');
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId, metricType, date, provider, goalValue, metricConfig]);

  useEffect(() => {
    if (visible) {
      fetchHistoricalData();
      modalY.value = withTiming(0, { 
        duration: 400, 
        easing: Easing.bezier(0.25, 0.1, 0.25, 1)
      });
      opacity.value = withTiming(1, { duration: 350 });
      chartProgress.value = withTiming(1, { 
        duration: 1000,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1) 
      });
    } else {
      modalY.value = 100;
      opacity.value = 0;
      chartProgress.value = 0;
      progressWidth.value = 0;
      setSelectedDay(null);
    }
  }, [visible, fetchHistoricalData]);

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: modalY.value }],
    opacity: opacity.value,
  }));
  
  const handleDaySelect = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const selected = historicalData[index];
    setSelectedDay(selected);
    
    progressWidth.value = withTiming(
      Math.min((selected.value / goalValue) * 100, 100),
      {
        duration: 500,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }
    );
  };

  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => {
      const color = metricColors[metricType] || theme.colors.primary;
      return `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${opacity})`;
    },
    labelColor: () => theme.colors.onSurfaceVariant,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: metricColors[metricType] || theme.colors.primary,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      strokeWidth: 0.5,
    },
  };

  const chartData = {
    labels: historicalData.map(item => item.dayOfWeek),
    datasets: [
      {
        data: historicalData.map(item => item.value),
        color: (opacity = 1) => `${metricColors[metricType]}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
        strokeWidth: 3,
      },
    ],
  };

  const formattedMetricValue = (value: number) => {
    const formattedValue = formatMetricValue(value, metricType, measurementSystem);
    return `${formattedValue.value} ${formattedValue.unit}`;
  };

  return (
    <Portal>
      <Modal 
        visible={visible} 
        onDismiss={onClose} 
        contentContainerStyle={[
          styles.modalContainer,
          { paddingBottom: Math.max(insets.bottom, 20) }
        ]}
      >
        <Animated.View 
          style={[
            styles.modalBackdrop,
            { opacity }
          ]}
        >
          <Pressable 
            style={{ flex: 1 }} 
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContent,
            { backgroundColor: theme.colors.surface },
            animatedModalStyle,
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
              onPress={onClose}
              style={styles.closeButton}
            />

            <View>
              <Text variant="headlineMedium" style={styles.modalTitle}>{title}</Text>
              <View style={styles.valueContainer}>
                <Animated.View style={{ transform: [{ scale: chartProgress }] }}>
                  <Text variant="displayMedium" style={[styles.modalValue, { color: metricColor }]}>
                    {selectedDay ? formattedMetricValue(selectedDay.value) : formattedMetricValue(value)}
                  </Text>
                </Animated.View>
                {selectedDay && (
                  <View style={styles.trendContainer}>
                    <MaterialCommunityIcons
                      name={metricConfig.icon}
                      size={20}
                      color={metricColor}
                    />
                    <Text style={styles.trendText}>
                      {selectedDay.formattedDate}
                      {DateUtils.isToday(selectedDay.date) && ' (Today)'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.chartContainer}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={metricColor} />
                    <Text style={styles.loadingText}>Loading historical data...</Text>
                  </View>
                ) : error ? (
                  <View style={styles.loadingContainer}>
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={32}
                      color={theme.colors.error}
                    />
                    <Text style={[styles.loadingText, { color: theme.colors.error }]}>
                      {error}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text variant="titleMedium" style={styles.modalTitle}>7-Day History</Text>
                    {['steps', 'distance', 'calories', 'flights_climbed'].includes(metricType) ? (
                      <BarChart
                        metricType={metricType}
                        data={historicalData.map(item => ({
                          date: item.date,
                          value: item.value,
                          dayName: item.dayOfWeek
                        }))}
                        onBarSelect={(value, dateStr, dayName) => {
                          const selected = historicalData.find(item => item.date === dateStr);
                          if (selected) {
                            setSelectedDay(selected);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            progressWidth.value = withTiming(
                              Math.min((value / goalValue) * 100, 100),
                              {
                                duration: 500,
                                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                              }
                            );
                          }
                        }}
                      />
                    ) : (
                      <LineChart
                        data={{
                          ...chartData,
                          datasets: [{
                            ...chartData.datasets[0],
                            data: metricType === 'heart_rate' 
                              ? [...chartData.datasets[0].data, 40, 200] 
                              : chartData.datasets[0].data
                          }]
                        }}
                        width={SCREEN_WIDTH - 64}
                        height={220}
                        chartConfig={{
                          ...chartConfig,
                          decimalPlaces: metricType === 'heart_rate' ? 0 : 1,
                          formatYLabel: (value) => {
                            if (metricType === 'heart_rate') {
                              return `${Math.round(Number(value))} bpm`;
                            } else if (metricType === 'basal_calories') {
                              return `${Math.round(Number(value))} cal`;
                            }
                            return value;
                          },
                          propsForBackgroundLines: {
                            ...chartConfig.propsForBackgroundLines,
                            strokeDasharray: metricType === 'heart_rate' ? '' : '5, 5',
                            strokeOpacity: 0.15,
                          },
                          propsForDots: {
                            ...chartConfig.propsForDots,
                            r: '4',
                            strokeWidth: '2',
                            stroke: metricColor,
                          },
                          strokeWidth: 2,
                          fillShadowGradient: metricColor,
                          fillShadowGradientOpacity: 0.1,
                        }}
                        bezier
                        style={{
                          ...styles.chart,
                          marginVertical: 8,
                          borderRadius: 16,
                          paddingRight: 16,
                        }}
                        withVerticalLines={false}
                        withHorizontalLines={true}
                        fromZero={metricType !== 'heart_rate'}
                        onDataPointClick={({index}) => handleDaySelect(index)}
                        segments={metricType === 'heart_rate' ? 5 : 4}
                      />
                    )}
                  </>
                )}
              </View>

              {/* Goal Progress Card */}
              <Card style={[styles.healthTipCard, { backgroundColor: theme.colors.surface }]}>
                <Card.Content>
                  <View style={styles.healthTipHeader}>
                    <MaterialCommunityIcons name="flag-checkered" size={20} color={theme.colors.primary} />
                    <Text variant="titleMedium" style={styles.healthTipTitle}>Goal Progress</Text>
                  </View>
                  
                  <View style={styles.progressContainer}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Current</Text>
                      <Text style={[styles.infoValue, { color: metricColor }]}>
                        {formattedMetricValue(selectedDay?.value || value)}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Daily Goal</Text>
                      <Text style={styles.infoValue}>
                        {formattedMetricValue(goalValue)}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Points</Text>
                      <Text style={[styles.infoValue, { color: metricColor }]}>
                        {selectedDay?.score.points || calculateMetricPoints(metricType, value, metricConfig).points} pts
                      </Text>
                    </View>
                    
                    <View style={[styles.chartContainer, { marginVertical: 12 }]}>
                      <View style={[
                        styles.progressBarContainer, 
                        { 
                          height: 8, 
                          backgroundColor: theme.colors.surfaceVariant,
                          borderRadius: 4 
                        }
                      ]}>
                        <Animated.View
                          style={[
                            {
                              height: '100%',
                              backgroundColor: metricColor,
                              borderRadius: 4,
                            },
                            useAnimatedStyle(() => ({
                              width: `${progressWidth.value}%`,
                            })),
                          ]}
                        />
                      </View>
                      <Text style={[styles.infoValue, { alignSelf: 'flex-end', marginTop: 4 }]}>
                        {Math.round(((selectedDay?.value || value) / goalValue) * 100)}%
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
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
