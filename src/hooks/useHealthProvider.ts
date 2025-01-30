import { useMemo, useEffect } from 'react';
import { HealthProviderFactory } from '../providers/health/factory/HealthProviderFactory';

export function useHealthProvider() {
  const provider = useMemo(() => {
    return HealthProviderFactory.getProvider();
  }, []);

  useEffect(() => {
    // Initialize provider on mount
    provider.initialize().catch(console.error);

    // Cleanup on unmount
    return () => {
      HealthProviderFactory.cleanup().catch(console.error);
    };
  }, [provider]);

  return provider;
}