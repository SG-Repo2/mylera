import { PermissionState, PermissionStatus } from '../../types/permissions';
import { RawHealthMetric } from '../../types/metrics';

export interface FitbitTokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface FitbitActivity {
  activityLevel?: string;
  duration: number;
}

export interface FitbitDailySummary {
  dateTime: string;
  summary?: {
    caloriesBMR?: number;
  };
}

export interface FitbitHeartRateData {
  'activities-heart': Array<{
    dateTime: string;
    value: {
      restingHeartRate?: number;
    };
  }>;
}

export interface FitbitStepsData {
  'activities-steps': Array<{
    dateTime: string;
    value: number;
  }>;
}

export interface FitbitDistanceData {
  'activities-distance': Array<{
    dateTime: string;
    value: number;
  }>;
}

export interface FitbitCaloriesData {
  'activities-calories': Array<{
    dateTime: string;
    value: number;
  }>;
}

export interface FitbitElevationData {
  'activities-elevation': Array<{
    dateTime: string;
    value: number;
  }>;
}

export interface FitbitActivitiesData {
  activities: FitbitActivity[];
}

export interface FitbitStorageKeys {
  ACCESS_TOKEN: string;
  REFRESH_TOKEN: string;
  TOKEN_EXPIRY: string;
  LAST_SYNC: string;
}

export interface FitbitProviderState {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  tokenRefreshInProgress: boolean;
  tokenRefreshPromise: Promise<void> | null;
  initialized: boolean;
  lastSyncTime: Date | null;
}
