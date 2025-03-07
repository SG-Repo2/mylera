import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import type { DailyTotal } from '@/src/types/schemas';

/**
 * Custom hook for Dashboard animations
 */
export const useDashboardAnimations = (dailyTotal: DailyTotal | null) => {
  // Header animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  
  // LoadingView animations
  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  
  // Animate header when dailyTotal becomes available
  useEffect(() => {
    if (dailyTotal) {
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 400, // Slightly faster for better response
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic), // Smoother easing
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 14, // Increased for less bounce
          mass: 0.8,
          stiffness: 180,
        }),
      ]).start();
    }
  }, [dailyTotal, headerOpacity, slideAnim]);
  
  // Start loading animations immediately
  useEffect(() => {
    Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.spring(pulseAnim, {
            toValue: 1,
            useNativeDriver: true,
            damping: 10,
            mass: 0.8,
            stiffness: 180,
          }),
          Animated.spring(pulseAnim, {
            toValue: 0.8,
            useNativeDriver: true,
            damping: 10,
            mass: 0.8,
            stiffness: 180,
          }),
        ])
      ),
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000,
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
  }, [pulseAnim, spinAnim]);
  
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