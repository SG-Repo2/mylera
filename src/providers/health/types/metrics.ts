export interface HealthMetrics {
  id: string;
  user_id: string;
  date: string;
  steps: number | null;
  distance: number | null;
  calories: number | null;
  heart_rate: number | null;
  daily_score: number;
  weekly_score: number | null;
  streak_days: number | null;
  last_updated: string;
  created_at: string;
  updated_at: string;
}