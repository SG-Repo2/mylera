import { useRef, useEffect } from 'react';
import { Animated, Easing, Dimensions } from 'react-native';
import type { DailyTotal } from '@/src/types/schemas';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Custom hook for Dashboard animations
 */
export const useDashboardAnimations = (dailyTotal: DailyTotal | null) => {
  // Header animations with responsive values
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  
  // LoadingView animations with responsive values
  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  
  // Calculate responsive animation values
  const slideDistance = Math.max(-16, Math.min(-20, -SCREEN_WIDTH * 0.04));
  const pulseRange = {
    min: Math.max(0.75, Math.min(0.8, 1 - (SCREEN_WIDTH * 0.0005))),
    max: Math.max(1.02, Math.min(1.05, 1 + (SCREEN_WIDTH * 0.0008)))
  };
  
  // Animate header when dailyTotal becomes available
  useEffect(() => {
    if (dailyTotal) {
      // Reset animation values to ensure consistent behavior
      headerOpacity.setValue(0);
      slideAnim.setValue(slideDistance);
      
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: Math.max(300, Math.min(350, SCREEN_WIDTH * 0.7)),
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: Math.max(14, Math.min(16, SCREEN_WIDTH * 0.03)),
          mass: Math.max(0.6, Math.min(0.7, SCREEN_WIDTH * 0.001)),
          stiffness: Math.max(180, Math.min(200, SCREEN_WIDTH * 0.4)),
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
        }),
      ]).start();
    }
  }, [dailyTotal, headerOpacity, slideAnim, slideDistance]);
  
  // Start loading animations immediately
  useEffect(() => {
    Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.spring(pulseAnim, {
            toValue: pulseRange.max,
            useNativeDriver: true,
            damping: Math.max(8, Math.min(10, SCREEN_WIDTH * 0.02)),
            mass: Math.max(0.7, Math.min(0.8, SCREEN_WIDTH * 0.001)),
            stiffness: Math.max(160, Math.min(180, SCREEN_WIDTH * 0.35)),
          }),
          Animated.spring(pulseAnim, {
            toValue: pulseRange.min,
            useNativeDriver: true,
            damping: Math.max(8, Math.min(10, SCREEN_WIDTH * 0.02)),
            mass: Math.max(0.7, Math.min(0.8, SCREEN_WIDTH * 0.001)),
            stiffness: Math.max(160, Math.min(180, SCREEN_WIDTH * 0.35)),
          }),
        ])
      ),
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: Math.max(1800, Math.min(2000, SCREEN_WIDTH * 4)),
          useNativeDriver: true,
        })
      ),
    ]).start();
    
    // Clean up animations on unmount
    return () => {
      pulseAnim.stopAnimation();
      spinAnim.stopAnimation();
      headerOpacity.stopAnimation();
      slideAnim.stopAnimation();
    };
  }, [pulseAnim, spinAnim, pulseRange]);
  
  return {
    // Header animations
    headerAnimations: {
      opacity: headerOpacity,
      transform: [{ translateY: slideAnim }]
    },
    
    // Loading animations
    loadingAnimations: {
      scale: pulseAnim,
      rotate: spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
      })
    }
  };
};