// src/types/leaderboard.ts

export type LeaderboardTimeframe = 'daily' | 'weekly';
export type DeviceType = 'os' | 'fitbit';

// Database table types
export interface UserProfile {
  id: string; // PRIMARY KEY, REFERENCES auth.users(id)
  display_name: string | null; // NULLABLE
  avatar_url: string | null; // NULLABLE
  show_profile: boolean; // DEFAULT false
  device_type: DeviceType | null; // NULLABLE
  measurement_system: 'metric' | 'imperial'; // NOT NULL DEFAULT 'metric'
  created_at: string; // timestamptz DEFAULT now()
  updated_at: string; // timestamptz DEFAULT now()
}

export interface DailyTotal {
  id: string; // uuid PRIMARY KEY
  user_id: string; // NOT NULL, REFERENCES auth.users(id)
  date: string; // date NOT NULL, DEFAULT current_date
  total_points: number; // int4 DEFAULT 0
  metrics_completed: number; // int4 DEFAULT 0
  created_at: string; // timestamptz DEFAULT now()
  updated_at: string; // timestamptz DEFAULT now()
  user_profiles?: UserProfile; // Join relationship
}

export interface WeeklyTotal {
  id: string; // uuid PRIMARY KEY
  user_id: string; // NOT NULL, REFERENCES auth.users(id)
  week_start: string; // date NOT NULL
  total_points: number; // int4 DEFAULT 0
  metrics_completed: number; // int4 DEFAULT 0
  created_at: string; // timestamptz DEFAULT now()
  updated_at: string; // timestamptz DEFAULT now()
  is_test_data: boolean; // boolean DEFAULT false
  user_profiles?: UserProfile; // Join relationship
}

// UI types
export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  metrics_completed: number;
  rank: number;
}
