import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import type { DailyTotal } from '@/src/types/schemas';

export const useEnhancedHeaderAnimations = (dailyTotal: DailyTotal | null) => {
  // Initialize all animated values with proper defaults
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const pointsScale = useRef(new Animated.Value(1)).current;
  const pointsGlow = useRef(new Animated.Value(0)).current;
  const shinePosition = useRef(new Animated.Value(-1)).current;
  const messageOpacity = useRef(new Animated.Value(0)).current;
  const messageTranslateY = useRef(new Animated.Value(10)).current;
  
  // Continuous breathing animation for logo
  useEffect(() => {
    const breathingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    breathingAnimation.start();
    return () => breathingAnimation.stop();
  }, [logoScale]);
  
  // Points change animation
  useEffect(() => {
    if (dailyTotal) {
      // Pulse animation
      Animated.sequence([
        Animated.timing(pointsScale, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(pointsScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 8,
          mass: 0.5,
          stiffness: 200,
        }),
      ]).start();
      
      // Glow animation
      Animated.sequence([
        Animated.timing(pointsGlow, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false, // Opacity can't use native driver
        }),
        Animated.timing(pointsGlow, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
      ]).start();
      
      // Shine effect
      Animated.timing(shinePosition, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        shinePosition.setValue(-1);
      });
      
      // Message animation
      Animated.parallel([
        Animated.timing(messageOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(messageTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 12,
          mass: 0.8,
          stiffness: 150,
        }),
      ]).start();
    }
  }, [dailyTotal?.total_points]);
  
  return {
    logoAnimations: {
      transform: [{ scale: logoScale }],
      opacity: logoOpacity,
    },
    pointsAnimations: {
      transform: [{ scale: pointsScale }],
      opacity: pointsGlow, // Use opacity instead of glow directly
    },
    messageAnimations: {
      opacity: messageOpacity,
      transform: [{ translateY: messageTranslateY }],
    },
    shine: shinePosition, // Export shine separately
  };
}; 