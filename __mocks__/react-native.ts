export const Platform = {
  OS: 'ios',
  select: (config: { ios?: any; android?: any; default?: any }) => {
    return config.ios || config.default;
  }
};

export const AsyncStorage = {
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(undefined),
  multiRemove: jest.fn().mockResolvedValue(undefined),
  mergeItem: jest.fn().mockResolvedValue(undefined)
};

export const NativeModules = {
  SettingsManager: {
    settings: {
      AppleLocale: 'en_US',
      AppleLanguages: ['en']
    }
  }
};

export const NativeEventEmitter = jest.fn().mockImplementation(() => ({
  addListener: jest.fn(),
  removeListener: jest.fn()
}));

export const Dimensions = {
  get: jest.fn().mockReturnValue({
    width: 900,
    height: 600,
    scale: 1,
    fontScale: 1
  }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

export const StyleSheet = {
  create: (styles: any) => styles,
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  flatten: (style: any) => style
};

export const Animated = {
  Value: jest.fn(() => ({
    setValue: jest.fn(),
    setOffset: jest.fn(),
    interpolate: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn()
  })),
  timing: jest.fn(() => ({
    start: jest.fn(cb => cb && cb({ finished: true }))
  })),
  spring: jest.fn(() => ({
    start: jest.fn(cb => cb && cb({ finished: true }))
  })),
  parallel: jest.fn((animations: any[]) => ({
    start: jest.fn(cb => animations.forEach((anim: { start?: () => void }) => anim.start && anim.start()))
  }))
};
