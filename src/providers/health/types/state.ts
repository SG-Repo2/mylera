import type { HealthProvider } from './provider';

export type ProviderStatus = 'initializing' | 'ready' | 'cleaning' | 'error';

export interface ProviderState {
  status: ProviderStatus;
  userId: string | null;
  error?: Error;
}

export interface ProviderManagerInterface {
  initializeProvider(userId: string, platform: string): Promise<HealthProvider>;
  cleanupProvider(userId: string): Promise<void>;
  getProvider(userId: string): HealthProvider | undefined;
}
