import { MetricType } from '@/src/types/metrics';

export interface MetricData {
  value: number;
  unit: string;
  timestamp: string;
  source: string;
}

export interface DisplayMetric {
  current: MetricData;
  previous?: MetricData;
  goal?: number;
  progress: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MetricCardProps {
  metric: DisplayMetric;
  type: MetricType;
  showComparison: boolean;
  onPress?: () => void;
  style?: any;
}

export interface DashboardMetrics {
  daily: Record<MetricType, DisplayMetric>;
  weekly: Record<MetricType, DisplayMetric[]>;
  goals: Record<MetricType, number>;
}

export interface LeaderboardMetrics {
  score: number;
  highlights: Partial<Record<MetricType, DisplayMetric>>;
  rank: number;
}