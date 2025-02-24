import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure fake timers globally
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
}); 