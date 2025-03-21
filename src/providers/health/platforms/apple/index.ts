// Re-export everything from a single entry point

export * from './types';
export * from './utils';
export * from './permissions';
export * from './initialization';
export * from './metricFetchers';
export * from './dataProcessing';
export { AppleHealthProvider } from './AppleHealthProvider';

// This barrel file allows importing everything from a single point:
// import { AppleHealthProvider, initializeHealthKit, ... } from '@/src/providers/health/platforms/apple';
