// Enum-like type for metric types based on your schema's CHECK constraint
export type MetricType = 'steps' | 'distance' | 'calories' | 'heart_rate' | 'exercise' | 'standing';

// Matches your daily_metric_scores table schema
export interface DailyMetricScore {
  id: string;              
  user_id: string;         
  date: string;           
  metric_type: MetricType; 
  goal_reached: boolean;   
  points: number;         
  created_at: string;     
  updated_at: string;     
}

// For updating metrics
export interface MetricUpdate {
  value: number;
  goal: number;
  type: MetricType;
}

// For the UI display
export interface MetricCardProps {
  title: string;
  value: number;
  goal: number;
  points: number;
  unit: string;
}

// For metric goals configuration (changed to type)
export type MetricGoals = {
  [key in MetricType]: {
    defaultGoal: number;
    unit: string;
  };
};