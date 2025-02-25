const AsyncStorage = {
  setItem: jest.fn((key, value) => {
    return Promise.resolve(value);
  }),
  getItem: jest.fn((key) => {
    return Promise.resolve(null);
  }),
  removeItem: jest.fn((key) => {
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => {
    return Promise.resolve([]);
  }),
};

export default AsyncStorage;
