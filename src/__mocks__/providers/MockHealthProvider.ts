import { BaseHealthProvider } from '../types/provider';
import type { HealthMetrics, RawHealthData, NormalizedMetric } from '../types/metrics';
import type { PermissionState, PermissionStatus } from '../types/permissions';
import type { MetricType } from '../../../types/metrics';

export class MockHealthProvider extends BaseHealthProvider {
  mockInitialize = jest.fn();
  mockCleanup = jest.fn();
  mockCheckPermissions = jest.fn();
  mockRequestPermissions = jest.fn();
  mockGetMetrics = jest.fn();
  mockFetchRawMetrics = jest.fn();
  mockNormalizeMetrics = jest.fn();

  protected async performInitialization(): Promise<void> {
    await this.mockInitialize();
  }

  async cleanup(): Promise<void> {
    await this.mockCleanup();
    await super.cleanup();
  }

  async requestPermissions(): Promise<PermissionStatus> {
    return this.mockRequestPermissions();
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    return this.mockCheckPermissions();
  }

  async getMetrics(): Promise<HealthMetrics> {
    return this.mockGetMetrics();
  }

  async fetchRawMetrics(
    startDate: Date,
    endDate: Date,
    types: MetricType[]
  ): Promise<RawHealthData> {
    return this.mockFetchRawMetrics(startDate, endDate, types);
  }

  normalizeMetrics(rawData: RawHealthData, type: MetricType): NormalizedMetric[] {
    return this.mockNormalizeMetrics(rawData, type);
  }

  // Default mock implementations
  constructor() {
    super();
    this.mockInitialize.mockResolvedValue(undefined);
    this.mockCleanup.mockResolvedValue(undefined);
    this.mockCheckPermissions.mockResolvedValue({ 
      status: 'granted', 
      lastChecked: Date.now() 
    });
    this.mockRequestPermissions.mockResolvedValue('granted');
    this.mockGetMetrics.mockResolvedValue({
      steps: 0,
      distance: 0,
      calories: 0,
      heart_rate: 0
    });
    this.mockFetchRawMetrics.mockResolvedValue({});
    this.mockNormalizeMetrics.mockReturnValue([]);
  }
} 