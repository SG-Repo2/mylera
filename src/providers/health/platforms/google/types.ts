import { MetricType } from '../../../../types/metrics';
import { RawHealthMetric, RawHealthData } from '../../types/metrics';

export interface StepsRecord {
  startTime: string;
  endTime: string;
  count: number;
}

export interface DistanceRecord {
  startTime: string;
  endTime: string;
  distance: {
    inMeters: number;
  };
}

export interface CaloriesRecord {
  startTime: string;
  endTime: string;
  energy?: {
    inKilocalories: number;
  };
}

export interface BasalRecord {
  startTime: string;
  endTime: string;
  metadata: {
    id: string;
  };
  energy: {
    inKilocalories: number;
  };
}

export interface HeartRateRecord {
  startTime: string;
  endTime: string;
  samples: Array<{
    beatsPerMinute: number;
  }>;
}

export interface ExerciseSessionRecord {
  startTime: string;
  endTime: string;
  metadata: {
    id: string;
  };
  exerciseType: number;
}

export type TimeRangeFilter = {
  operator: 'between';
  startTime: string;
  endTime: string;
};

export type { MetricType, RawHealthMetric, RawHealthData }; 