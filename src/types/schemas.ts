import { z } from 'zod';

// Enum for metric types
export const MetricTypeEnum = z.enum([
  'steps',
  'distance', 
  'calories',
  'heart_rate',
  'exercise',
  'standing',
  'sleep'
]);

// Schema for metric updates
export const MetricUpdateSchema = z.object({
  value: z.number()
    .min(0, 'Value must be non-negative')
    .finite('Value must be finite'),
  goal: z.number()
    .min(1, 'Goal must be at least 1')
    .finite('Goal must be finite'),
  type: MetricTypeEnum
});

// Schema for daily metric scores
export const DailyMetricScoreSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  metric_type: MetricTypeEnum,
  goal_reached: z.boolean(),
  points: z.number().int().min(0).max(150),
  value: z.number().min(0),
  goal: z.number().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// Schema for metric goals
export const MetricGoalSchema = z.object({
  defaultGoal: z.number().min(1),
  unit: z.string().min(1)
});

export const MetricGoalsSchema = z.record(MetricTypeEnum, MetricGoalSchema);

// Type inference helpers
export type MetricTypeEnum = z.infer<typeof MetricTypeEnum>;
export type MetricUpdate = z.infer<typeof MetricUpdateSchema>;
export type DailyMetricScoreSchema = z.infer<typeof DailyMetricScoreSchema>;
export type MetricGoals = z.infer<typeof MetricGoalsSchema>;

// Custom error class for validation errors
export class MetricValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: z.ZodError['errors']
  ) {
    super(message);
    this.name = 'MetricValidationError';
  }
}

export interface DailyTotal {
  id: string;
  user_id: string;
  date: string;
  total_points: number;
  metrics_completed: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  show_profile: boolean;
  created_at: string;
  updated_at: string;
}