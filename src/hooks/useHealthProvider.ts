import { useMemo } from 'react';
import { HealthProviderFactory } from '../providers/health/factory/HealthProviderFactory';

export function useHealthProvider() {
  return useMemo(() => HealthProviderFactory.getProvider(), []);
}