import React, { useMemo } from 'react';
import { View, Animated, Platform, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useDashboardStyles } from '@/src/styles/useDashboardStyles';
import { useEnhancedHeaderAnimations } from '@/src/hooks/useEnhancedHeaderAnimations';
import type { DailyTotal } from '@/src/types/schemas';

interface EnhancedHeaderProps {
  dailyTotal: DailyTotal;
}

const getMotivationalMessage = (points: number): string => {
  if (points >= 1000) return 'Amazing! You\'re crushing it! 🚀';
  if (points >= 500) return 'Great job! Keep up the momentum! 💪';
  if (points >= 250) return 'You\'re doing well! Keep going! 🌟';
  return 'Every step counts! Keep moving! 👣';
};

const getGradientColors = (points: number, theme: any): [string, string] => {
  if (points >= 1000) {
    return [theme.colors.primary, theme.colors.success];
  }
  if (points >= 500) {
    return [theme.colors.primary, theme.colors.secondary];
  }
  return [theme.colors.primary, theme.colors.primaryContainer];
};

export const EnhancedHeader = React.memo(function EnhancedHeader({
  dailyTotal,
}: EnhancedHeaderProps) {
  const styles = useDashboardStyles();
  const theme = useTheme();
  const { logoAnimations, pointsAnimations, messageAnimations, shine } = useEnhancedHeaderAnimations(dailyTotal);
  
  const gradientColors = useMemo(() => 
    getGradientColors(dailyTotal.total_points, theme),
    [dailyTotal.total_points, theme]
  );
  
  const message = useMemo(() => 
    getMotivationalMessage(dailyTotal.total_points),
    [dailyTotal.total_points]
  );
  
  return (
    <View style={styles.headerWrapper}>
      <Animated.View style={[styles.headerContainer]}>
        <Animated.View style={{ opacity: 0.1 }}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        
        <Animated.View style={[styles.messageContainer, messageAnimations]}>
          <Text style={styles.messageText}>{message}</Text>
        </Animated.View>
        
        <View style={styles.headerContent}>
          <Animated.View style={[styles.logoContainer, logoAnimations]}>
            <Animated.Image
              source={require('@/assets/images/myLeraBanner.png')}
              style={[styles.logo]}
            />
          </Animated.View>
          
          <Animated.View style={[styles.statItem, pointsAnimations]}>
            <Animated.View
              style={[
                styles.shineEffect,
                {
                  transform: [
                    {
                      translateX: shine.interpolate({
                        inputRange: [-1, 1],
                        outputRange: ['-100%', '100%'],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Text style={styles.statText}>{dailyTotal.total_points} pts</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}); 