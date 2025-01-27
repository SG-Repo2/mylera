import type { HealthMetrics } from './metrics';

export interface HealthProvider {
  initialize(): Promise<void>;
  requestPermissions(): Promise<boolean>;
  checkPermissionsStatus(): Promise<boolean>;
  cleanup(): Promise<void>;
  getMetrics(): Promise<HealthMetrics>;
}