import { z } from 'zod';
import { StyleProp, ViewStyle } from 'react-native';
import { MetricType, MetricTypeEnum } from '@/src/types/schemas';

// Zod schema for metric data
export const MetricDataSchema = z.object({
  value: z.number().min(0),
  unit: z.string().min(1),
  timestamp: z.string().datetime(),
  source: z.string().min(1)
});

// Zod schema for display metrics
export const DisplayMetricSchema = z.object({
  current: MetricDataSchema,
  previous: MetricDataSchema.optional(),
  goal: z.number().min(0).optional(),
  progress: z.number().min(0).max(100),
  trend: z.enum(['up', 'down', 'stable'])
});

// Zod schema for metric card props
export const MetricCardPropsSchema = z.object({
  metric: DisplayMetricSchema,
  type: MetricTypeEnum,
  showComparison: z.boolean(),
  onPress: z.function().optional(),
  style: z.any().optional() // StyleProp can't be validated by Zod, but we type it properly in the interface
});

// Zod schema for dashboard metrics
export const DashboardMetricsSchema = z.object({
  daily: z.record(MetricTypeEnum, DisplayMetricSchema),
  weekly: z.record(MetricTypeEnum, z.array(DisplayMetricSchema)),
  goals: z.record(MetricTypeEnum, z.number().min(0))
});

// Zod schema for leaderboard metrics
export const LeaderboardMetricsSchema = z.object({
  score: z.number().min(0),
  highlights: z.record(MetricTypeEnum, DisplayMetricSchema).optional(),
  rank: z.number().min(1)
});

// Type definitions inferred from schemas
export type MetricData = z.infer<typeof MetricDataSchema>;
export type DisplayMetric = z.infer<typeof DisplayMetricSchema>;

// Extended interface for MetricCardProps to properly type the style prop
export interface MetricCardProps extends Omit<z.infer<typeof MetricCardPropsSchema>, 'style'> {
  style?: StyleProp<ViewStyle>;
}

export type DashboardMetrics = z.infer<typeof DashboardMetricsSchema>;
export type LeaderboardMetrics = z.infer<typeof LeaderboardMetricsSchema>;

// Validation helper functions
export const validateMetricData = (data: unknown): MetricData => {
  const result = MetricDataSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid metric data: ${result.error.message}`);
  }
  return result.data;
};

export const validateDisplayMetric = (metric: unknown): DisplayMetric => {
  const result = DisplayMetricSchema.safeParse(metric);
  if (!result.success) {
    throw new Error(`Invalid display metric: ${result.error.message}`);
  }
  return result.data;
};

export const validateDashboardMetrics = (metrics: unknown): DashboardMetrics => {
  const result = DashboardMetricsSchema.safeParse(metrics);
  if (!result.success) {
    throw new Error(`Invalid dashboard metrics: ${result.error.message}`);
  }
  return result.data;
};

export const validateLeaderboardMetrics = (metrics: unknown): LeaderboardMetrics => {
  const result = LeaderboardMetricsSchema.safeParse(metrics);
  if (!result.success) {
    throw new Error(`Invalid leaderboard metrics: ${result.error.message}`);
  }
  return result.data;
};