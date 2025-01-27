// src/types/leaderboard.ts

// Database table types
export interface UserProfile {
    id: string;                   // PRIMARY KEY, REFERENCES auth.users(id)
    display_name: string | null;  // NULLABLE
    avatar_url: string | null;    // NULLABLE
    show_profile: boolean;        // DEFAULT false
    created_at: string;          // timestamptz DEFAULT now()
    updated_at: string;          // timestamptz DEFAULT now()
  }
  
  export interface DailyTotal {
    id: string;                  // uuid PRIMARY KEY
    user_id: string;            // NOT NULL, REFERENCES auth.users(id)
    date: string;               // date NOT NULL, DEFAULT current_date
    total_points: number;       // int4 DEFAULT 0
    metrics_completed: number;   // int4 DEFAULT 0
    created_at: string;         // timestamptz DEFAULT now()
    updated_at: string;         // timestamptz DEFAULT now()
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