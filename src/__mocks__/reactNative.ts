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

// Mock Platform
const Platform = {
  OS: 'ios',
  select: jest.fn((obj: { ios?: any; android?: any; default?: any }) => {
    if (obj.ios) return obj.ios;
    if (obj.android) return obj.android;
    return obj.default;
  }),
  setPlatform: function(platform: string) {
    this.OS = platform;
  },
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
  },
  StyleSheet: {
    create: jest.fn(styles => styles),
    flatten: jest.fn(style => style),
  },
  AppState: new MockEventEmitter(),
  View: createMockComponent('View'),
  Text: createMockComponent('Text'),
  TouchableOpacity: createMockComponent('TouchableOpacity'),
  Image: createMockComponent('Image'),
  Animated,
};

// Export helper functions for testing
export {
  MockEventEmitter,
  createMockComponent,
  AnimatedValue,
  Platform,
};
