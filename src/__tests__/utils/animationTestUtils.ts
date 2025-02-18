import { Animated } from 'react-native';
import type { MetricType } from '@/src/types/metrics';

interface AnimatedListener {
  remove: () => void;
}

interface InterpolationConfig {
  inputRange: number[];
  outputRange: number[] | string[];
}

export class AnimatedValueMock implements Animated.Value {
  private _value: number;
  private _offset: number;
  private _listeners: Function[];
  private _animation: any;

  constructor(value: number) {
    this._value = value;
    this._offset = 0;
    this._listeners = [];
    this._animation = null;
  }

  setValue(value: number): void {
    this._value = value;
    this._listeners.forEach(listener => listener({ value }));
  }

  setOffset(offset: number): void {
    this._offset = offset;
  }

  flattenOffset(): void {
    this._value += this._offset;
    this._offset = 0;
  }

  extractOffset(): void {
    this._offset += this._value;
    this._value = 0;
  }

  addListener(callback: (state: { value: number }) => void): AnimatedListener {
    this._listeners.push(callback);
    return {
      remove: () => this.removeListener(callback),
    };
  }

  removeListener(callback: Function): void {
    const index = this._listeners.indexOf(callback);
    if (index > -1) this._listeners.splice(index, 1);
  }

  removeAllListeners(): void {
    this._listeners = [];
  }

  stopAnimation(callback?: (value: number) => void): void {
    this._animation = null;
    callback?.(this._value);
  }

  resetAnimation(callback?: (value: number) => void): void {
    this._value = 0;
    this._offset = 0;
    callback?.(0);
  }

  interpolate(config: InterpolationConfig) {
    return {
      _interpolation: config,
      __getValue: () => {
        const { inputRange, outputRange } = config;
        const index = inputRange.findIndex(x => x >= this._value) - 1;
        if (index < 0) return outputRange[0];
        if (index >= inputRange.length - 1) return outputRange[outputRange.length - 1];
        
        const progress = (this._value - inputRange[index]) / 
          (inputRange[index + 1] - inputRange[index]);
        
        if (typeof outputRange[0] === 'string') {
          // For string interpolation (e.g., colors), return first value
          return outputRange[0];
        }
        
        return (outputRange[index] as number) + 
          progress * ((outputRange[index + 1] as number) - (outputRange[index] as number));
      },
    };
  }

  __getValue(): number {
    return this._value + this._offset;
  }

  __attach(): void {}
  __detach(): void {}
  __makeNative(): void {}
  __getNativeTag(): number { return -1; }
  __getAnimatedValue(): number { return this.__getValue(); }
  __addChild(_: any): void {}
  __removeChild(_: any): void {}
  __getChildren(): any[] { return []; }
}

// Mock Animated.timing
export const mockTiming = (value: Animated.Value, config: Animated.TimingAnimationConfig) => ({
  start: (callback?: (result: { finished: boolean }) => void) => {
    (value as any).setValue(config.toValue);
    callback?.({ finished: true });
  },
});

// Mock Animated.spring
export const mockSpring = (value: Animated.Value, config: Animated.SpringAnimationConfig) => ({
  start: (callback?: (result: { finished: boolean }) => void) => {
    (value as any).setValue(typeof config.toValue === 'number' ? config.toValue : 1);
    callback?.({ finished: true });
  },
});

// Mock Animated.sequence
export const mockSequence = (animations: Animated.CompositeAnimation[]) => ({
  start: (callback?: (result: { finished: boolean }) => void) => {
    animations.forEach(anim => anim.start());
    callback?.({ finished: true });
  },
});

// Mock Animated.parallel
export const mockParallel = (animations: Animated.CompositeAnimation[]) => ({
  start: (callback?: (result: { finished: boolean }) => void) => {
    animations.forEach(anim => anim.start());
    callback?.({ finished: true });
  },
});

// Types for component mocks
export interface MetricCardMockProps {
  metricType: MetricType;
  title: string;
  value: number;
  points: number;
  goal: number;
  unit: string;
  icon: string;
  onPress: (metricType: MetricType) => void;
}

export interface MetricModalMockProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: number;
  metricType: MetricType;
  additionalInfo?: Array<{
    label: string;
    value: string | number;
  }>;
}

export interface GoalCelebrationMockProps {
  visible: boolean;
  onClose: () => void;
  bonusPoints: number;
}

// Setup animation mocks for testing
export const setupAnimationMocks = () => {
  jest.spyOn(Animated, 'Value').mockImplementation((value) => new AnimatedValueMock(value));
  jest.spyOn(Animated, 'timing').mockImplementation(mockTiming as any);
  jest.spyOn(Animated, 'spring').mockImplementation(mockSpring as any);
  jest.spyOn(Animated, 'sequence').mockImplementation(mockSequence as any);
  jest.spyOn(Animated, 'parallel').mockImplementation(mockParallel as any);
};

// Cleanup animation mocks
export const cleanupAnimationMocks = () => {
  jest.restoreAllMocks();
};

// Helper to track render counts
export const createRenderTracker = () => {
  const renderCounts = new Map<string, number>();
  
  return {
    track: (componentId: string) => {
      const currentCount = renderCounts.get(componentId) || 0;
      renderCounts.set(componentId, currentCount + 1);
      return currentCount + 1;
    },
    getCount: (componentId: string) => renderCounts.get(componentId) || 0,
    reset: () => renderCounts.clear(),
  };
};
