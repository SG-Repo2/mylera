import { useRef, useEffect, useMemo } from 'react';
import { Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MetricCardAnimationProps {
  value: number | null;
  valueChangeAnim?: Animated.Value;
}

export const useMetricCardAnimations = ({ value, valueChangeAnim }: MetricCardAnimationProps) => {
  // Animation refs with responsive values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const valueChangePulseAnim = useRef(new Animated.Value(0)).current;
  const prevValueRef = useRef<number | null>(null);
  
  // Calculate responsive animation values
  const scaleValue = Math.max(0.97, Math.min(0.98, 1 - (SCREEN_WIDTH * 0.0001)));
  const glowOpacity = Math.max(0.15, Math.min(0.25, SCREEN_WIDTH * 0.0004));
  const pulseScale = Math.max(1.08, Math.min(1.12, 1 + (SCREEN_WIDTH * 0.0002)));
  
  // Handle value changes and animate accordingly
  useEffect(() => {
    if (prevValueRef.current !== null && prevValueRef.current !== value) {
      if (value === null || prevValueRef.current === null) {
        // Don't animate null transitions
        prevValueRef.current = value;
        return;
      }
      
      const percentChange = Math.abs(((value - prevValueRef.current) / prevValueRef.current));
      
      // Only animate significant changes (more than 1%)
      if (percentChange > 0.01 && !valueChangeAnim) {
        // Cancel any previous animation
        valueChangePulseAnim.stopAnimation();
        valueChangePulseAnim.setValue(0);
        
        // Animate with optimal timing values for mobile
        Animated.sequence([
          Animated.timing(valueChangePulseAnim, {
            toValue: 1,
            duration: Math.max(200, Math.min(250, SCREEN_WIDTH * 0.5)),
            useNativeDriver: true,
          }),
          Animated.timing(valueChangePulseAnim, {
            toValue: 0,
            duration: Math.max(300, Math.min(350, SCREEN_WIDTH * 0.7)),
            useNativeDriver: true,
          })
        ]).start();
      }
    }
    
    prevValueRef.current = value;
  }, [value, valueChangePulseAnim, valueChangeAnim]);

  // Press animations with responsive values
  const handlePressIn = () => {
    // Cancel ongoing animations for immediate feedback
    scaleAnim.stopAnimation();
    glowAnim.stopAnimation();
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: scaleValue,
        useNativeDriver: true,
        stiffness: Math.max(280, Math.min(300, SCREEN_WIDTH * 0.6)),
        damping: Math.max(12, Math.min(15, SCREEN_WIDTH * 0.03)),
        mass: Math.max(0.6, Math.min(0.7, SCREEN_WIDTH * 0.001)),
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: Math.max(100, Math.min(120, SCREEN_WIDTH * 0.2)),
        useNativeDriver: true
      })
    ], { stopTogether: false }).start();
  };

  const handlePressOut = () => {
    // Cancel ongoing animations for immediate feedback
    scaleAnim.stopAnimation();
    glowAnim.stopAnimation();
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: Math.max(280, Math.min(300, SCREEN_WIDTH * 0.6)),
        damping: Math.max(15, Math.min(18, SCREEN_WIDTH * 0.035)),
        mass: Math.max(0.6, Math.min(0.7, SCREEN_WIDTH * 0.001)),
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: Math.max(150, Math.min(180, SCREEN_WIDTH * 0.35)),
        useNativeDriver: true
      })
    ], { stopTogether: false }).start();
  };

  // Memoize the combined value change animation
  const combinedValueChangeAnim = useMemo(() => {
    const baseAnim = valueChangeAnim || valueChangePulseAnim;
    
    return baseAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, pulseScale, 1]
    });
  }, [valueChangeAnim, valueChangePulseAnim, pulseScale]);
  
  // Memoize the background animation
  const backgroundColorAnim = useMemo(() => {
    return valueChangeAnim || valueChangePulseAnim;
  }, [valueChangeAnim, valueChangePulseAnim]);

  // Add cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Stop all animations when component unmounts
      scaleAnim.stopAnimation();
      glowAnim.stopAnimation();
      valueChangePulseAnim.stopAnimation();
      if (valueChangeAnim) valueChangeAnim.stopAnimation();
      if (backgroundColorAnim) backgroundColorAnim.stopAnimation();
    };
  }, []); // Empty dependency array ensures this runs only on mount/unmount

  return {
    scaleAnim,
    glowAnim,
    combinedValueChangeAnim,
    backgroundColorAnim,
    handlePressIn,
    handlePressOut,
  };
};