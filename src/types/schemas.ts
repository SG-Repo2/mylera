import { z } from 'zod';
import { UserProfile } from './leaderboard';

// Core MetricType enum - single source of truth
export const MetricTypeEnum = z.enum([
  'steps',
  'distance',
  'calories',
  'heart_rate',
  'exercise',
  'basal_calories',
  'flights_climbed'
]);

// Schema for metric updates
export const MetricUpdateSchema = z.object({
  value: z.number().min(0).finite(),
  timestamp: z.string().optional(),
  unit: z.string().optional()
});

// Schema for daily metric scores
export const DailyMetricScoreSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(), 
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  metric_type: z.enum([
    'steps',
    'distance',
    'calories',
    'heart_rate',
    'exercise',
    'basal_calories',
    'flights_climbed'
  ]),
  goal_reached: z.boolean(),
  points: z.number().int().min(0).max(150),
  value: z.number().min(0),
  goal: z.number().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// Schema for metric goals
export const MetricGoalSchema = z.object({
  defaultGoal: z.union([
    z.number().min(1),
    z.object({
      systolic: z.number().min(1),
      diastolic: z.number().min(1)
    })
  ]),
  unit: z.string().min(1)
});

export const MetricGoalsSchema = z.record(z.string(), MetricGoalSchema);

// Export types derived from schemas
export type MetricType = z.infer<typeof MetricTypeEnum>;
export type MetricValue = z.infer<typeof MetricUpdateSchema>['value'];
export type MetricGoal = z.infer<typeof MetricGoalSchema>['defaultGoal'];
export type MetricUpdate = z.infer<typeof MetricUpdateSchema>;
export type DailyMetricScore = z.infer<typeof DailyMetricScoreSchema>;
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