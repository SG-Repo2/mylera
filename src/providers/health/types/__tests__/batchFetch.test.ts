import { BaseHealthProvider } from '../provider';
import { MetricType } from '@/src/types/metrics';
import { HealthMetrics, RawHealthData, NormalizedMetric } from '../metrics';
import { PermissionState, PermissionStatus } from '../permissions';

// Mock implementation for testing the batchFetchHealthMetrics method
class TestBatchProvider extends BaseHealthProvider {
  public fetchedTypes: MetricType[] = [];

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async fetchRawMetrics(startDate: Date, endDate: Date, types: string[]): Promise<RawHealthData> {
    // Record which types were requested
    this.fetchedTypes = types as MetricType[];

    // Create mock data for each requested type
    const mockData: RawHealthData = {};

    types.forEach(type => {
      if (type === 'steps') {
        mockData.steps = [
          {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            value: 5000,
            unit: 'count',
          },
        ];
      }
      if (type === 'distance') {
        mockData.distance = [
          {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            value: 3000,
            unit: 'meters',
          },
        ];
      }
      if (type === 'heart_rate') {
        mockData.heart_rate = [
          {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            value: 75,
            unit: 'bpm',
          },
        ];
      }
    });

    return mockData;
  }

  normalizeMetrics(rawData: RawHealthData, type: MetricType): NormalizedMetric[] {
    // Simple normalization for testing
    if (rawData[type]) {
      return rawData[type].map(item => ({
        timestamp: item.startDate,
        value: item.value,
        unit: item.unit,
        type,
      }));
    }
    return [];
  }

  // Expose the protected method for testing
  public async testBatchFetch(
    startDate: Date,
    endDate: Date,
    types: MetricType[]
  ): Promise<HealthMetrics> {
    return this.batchFetchHealthMetrics(startDate, endDate, types);
  }

  async getMetrics(): Promise<HealthMetrics> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    return this.testBatchFetch(startOfDay, now, [
      'steps',
      'distance',
      'heart_rate',
    ] as MetricType[]);
  }

  async requestPermissions(): Promise<PermissionStatus> {
    return 'granted';
  }

  async checkPermissionsStatus(): Promise<PermissionState> {
    return { status: 'granted', lastChecked: Date.now() };
  }
}

// Mock the logger
jest.mock('@/src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  LogCategory: {
    Health: 'Health',
  },
}));

describe('batchFetchHealthMetrics', () => {
  let provider: TestBatchProvider;

  beforeEach(() => {
    provider = new TestBatchProvider();
    jest.clearAllMocks();
  });

  it('should fetch multiple metrics in a single call', async () => {
    // Setup
    await provider.initialize();
    const startDate = new Date('2023-01-01T00:00:00.000Z');
    const endDate = new Date('2023-01-01T23:59:59.999Z');
    const metricTypes: MetricType[] = ['steps', 'distance', 'heart_rate'];

    // Execute
    const result = await provider.testBatchFetch(startDate, endDate, metricTypes);

    // Verify
    expect(provider.fetchedTypes).toEqual(metricTypes);
    expect(provider.fetchedTypes.length).toBe(metricTypes.length); // Should make only one call with all types

    // Verify all requested metrics are in the result
    expect(result).toHaveProperty('steps');
    expect(result).toHaveProperty('distance');
    expect(result).toHaveProperty('heart_rate');

    // Verify values are correctly processed
    expect(result.steps).toBe(5000);
    expect(result.distance).toBe(3000);
    expect(result.heart_rate).toBe(75);
  });

  it('should return empty metrics object for empty types array', async () => {
    // Setup
    await provider.initialize();
    const startDate = new Date('2023-01-01T00:00:00.000Z');
    const endDate = new Date('2023-01-01T23:59:59.999Z');

    // Execute
    const result = await provider.testBatchFetch(startDate, endDate, []);

    // Verify
    expect(provider.fetchedTypes).toEqual([]);
    expect(result.steps).toBeNull();
    expect(result.distance).toBeNull();
    expect(result.heart_rate).toBeNull();
  });

  it('should handle errors in metric processing', async () => {
    // Setup
    await provider.initialize();
    const startDate = new Date('2023-01-01T00:00:00.000Z');
    const endDate = new Date('2023-01-01T23:59:59.999Z');

    // Mock normalizeMetrics to throw for distance
    jest.spyOn(provider, 'normalizeMetrics').mockImplementation((rawData, type) => {
      if (type === 'distance') {
        throw new Error('Failed to normalize distance data');
      }
      return [];
    });

    // Execute
    const result = await provider.testBatchFetch(startDate, endDate, [
      'steps',
      'distance',
      'heart_rate',
    ] as MetricType[]);

    // Verify
    expect(result.steps).toBe(0); // Empty array aggregates to 0
    expect(result.distance).toBeNull(); // Error should result in null
    expect(result.heart_rate).toBe(0); // Empty array aggregates to 0
  });
});
