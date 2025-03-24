import { useRef, useEffect, useMemo } from 'react';
import { Animated } from 'react-native';

interface MetricCardAnimationProps {
  value: number | null;
  valueChangeAnim?: Animated.Value;
}

export const useMetricCardAnimations = ({ value, valueChangeAnim }: MetricCardAnimationProps) => {
  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const valueChangePulseAnim = useRef(new Animated.Value(0)).current;
  const prevValueRef = useRef<number | null>(null);
  
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
            duration: 250, // Slightly reduced for better mobile performance
            useNativeDriver: true,
          }),
          Animated.timing(valueChangePulseAnim, {
            toValue: 0,
            duration: 350, // Extended for smoother fade out
            useNativeDriver: true,
          })
        ]).start();
      }
    }
    
    prevValueRef.current = value;
  }, [value, valueChangePulseAnim, valueChangeAnim]);

  // Press animations
  const handlePressIn = () => {
    // Cancel ongoing animations for immediate feedback
    scaleAnim.stopAnimation();
    glowAnim.stopAnimation();
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.97,  // Slightly less scale for more subtle effect
        useNativeDriver: true,
        stiffness: 300, // Higher stiffness for faster initial response
        damping: 15,    // Balanced damping for natural feel
        mass: 0.7,      // Lighter mass for quicker animation
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 120,  // Faster glow effect for immediate feedback
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
        stiffness: 300,
        damping: 18,    // Increased damping for less bounce on return
        mass: 0.7,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 180,  // Slightly longer fade-out for natural feel
        useNativeDriver: true
      })
    ], { stopTogether: false }).start();
  };

  // Memoize the combined value change animation
  const combinedValueChangeAnim = useMemo(() => {
    const baseAnim = valueChangeAnim || valueChangePulseAnim;
    
    return baseAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 1.12, 1] // Slightly increased for better visibility on mobile
    });
  }, [valueChangeAnim, valueChangePulseAnim]);
  
  // Memoize the background animation
  const backgroundColorAnim = useMemo(() => {
    return valueChangeAnim || valueChangePulseAnim;
  }, [valueChangeAnim, valueChangePulseAnim]);

  return {
    scaleAnim,
    glowAnim,
    combinedValueChangeAnim,
    backgroundColorAnim,
    handlePressIn,
    handlePressOut,
  };
};