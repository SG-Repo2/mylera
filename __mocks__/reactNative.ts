// Platform-specific mock configuration
const Platform = {
  OS: 'ios',
  select: jest.fn((obj: { ios?: any; android?: any; default?: any }) => {
    if (Platform.OS === 'ios' && obj.ios) return obj.ios;
    if (Platform.OS === 'android' && obj.android) return obj.android;
    return obj.default;
  }),
  setPlatform: function(platform: string) {
    this.OS = platform;
  },
};

// Mock EventEmitter for AppState
class MockEventEmitter {
  private listeners: { [key: string]: Function } = {};
  public currentState: string = 'active';

  addListener = jest.fn((event: string, callback: Function) => {
    this.listeners[event] = callback;
    return { remove: jest.fn() };
  });

  addEventListener = jest.fn((event: string, callback: Function) => {
    this.addListener(event, callback);
    return { remove: jest.fn() };
  });

  removeAllListeners = jest.fn();
  
  emit = jest.fn((event: string, ...args: any[]) => {
    Object.values(this.listeners).forEach(callback => {
      if (typeof callback === 'function') {
        callback(...args);
      }
    });
  });
}

// Mock component props interface
interface ComponentProps {
  children?: React.ReactNode;
  testID?: string;
  [key: string]: any;
}

// Create mock component helper
const createMockComponent = (name: string) => {
  const Component = ({ children, testID, ...props }: ComponentProps) => ({
    $$typeof: Symbol.for('react.element'),
    type: name,
    props: { ...props, testID, children },
    ref: null,
  });
  Component.displayName = name;
  return Component;
};

// Mock Animated
class AnimatedValue {
  private _value: number;
  private _listeners: Function[];

  constructor(value: number) {
    this._value = value;
    this._listeners = [];
  }

  setValue(value: number): void {
    this._value = value;
    this._listeners.forEach(listener => listener({ value }));
  }

  interpolate({ inputRange, outputRange }: { inputRange: number[], outputRange: number[] }) {
    return {
      _interpolation: { inputRange, outputRange },
      __getValue: () => {
        const input = this._value;
        const index = inputRange.findIndex(x => x >= input) - 1;
        if (index < 0) return outputRange[0];
        if (index >= inputRange.length - 1) return outputRange[outputRange.length - 1];
        const progress = (input - inputRange[index]) / (inputRange[index + 1] - inputRange[index]);
        return outputRange[index] + progress * (outputRange[index + 1] - outputRange[index]);
      },
    };
  }

  addListener(callback: Function) {
    this._listeners.push(callback);
    return { remove: () => this.removeListener(callback) };
  }

  removeListener(callback: Function): void {
    const index = this._listeners.indexOf(callback);
    if (index > -1) this._listeners.splice(index, 1);
  }

  __getValue(): number {
    return this._value;
  }
}

const Animated = {
  View: createMockComponent('Animated.View'),
  Text: createMockComponent('Animated.Text'),
  Value: AnimatedValue,
  timing: jest.fn((value: any, config: { toValue: number }) => ({
    start: jest.fn((callback?: (result: { finished: boolean }) => void) => {
      value.setValue(config.toValue);
      callback?.({ finished: true });
    }),
  })),
  sequence: jest.fn((animations: any[]) => ({
    start: jest.fn((callback?: (result: { finished: boolean }) => void) => {
      animations.forEach(anim => anim.start());
      callback?.({ finished: true });
    }),
  })),
  parallel: jest.fn((animations: any[]) => ({
    start: jest.fn((callback?: (result: { finished: boolean }) => void) => {
      animations.forEach(anim => anim.start());
      callback?.({ finished: true });
    }),
  })),
};

// Export mock React Native components and APIs
export default {
  Platform,
  NativeAnimatedHelper: {
    addListener: jest.fn(),
    removeListeners: jest.fn(),
    removeListener: jest.fn(),
    dispatch: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  StyleSheet: {
    create: jest.fn(styles => styles),
    flatten: jest.fn(style => style),
    hairlineWidth: 1,
    absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  },
  AppState: new MockEventEmitter(),
  View: createMockComponent('View'),
  Text: createMockComponent('Text'),
  TouchableOpacity: createMockComponent('TouchableOpacity'),
  Image: createMockComponent('Image'),
  Animated,
  PixelRatio: {
    get: jest.fn(() => 2),
    getFontScale: jest.fn(() => 1),
    getPixelSizeForLayoutSize: jest.fn(size => size * 2),
    roundToNearestPixel: jest.fn(size => size),
  },
};

// Export helper functions for testing
export {
  MockEventEmitter,
  createMockComponent,
  AnimatedValue,
  Platform,
};
