# MyLera App Architecture Documentation

## Overview
MyLera is a React Native application built with Expo that uses Supabase for authentication and data storage. The app features a health metrics dashboard and leaderboard system.

## Project Structure
```
mylera/
├── assets/
│   └── images/
├── src/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── screens/
│   │   │   │   └── LoginScreen.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts
│   │   ├── metrics/
│   │   │   ├── screens/
│   │   │   │   └── MetricsDashboardScreen.tsx
│   │   │   ├── components/
│   │   │   │   └── MetricCard.tsx
│   │   ├── leaderboard/
│   │   │   ├── screens/
│   │   │   │   └── LeaderboardScreen.tsx
│   │   │   ├── components/
│   │   │   │   └── LeaderboardItem.tsx
│   ├── services/
│   │   ├── supabaseClient.ts
│   │   ├── metricsService.ts
│   │   ├── leaderboardService.ts
│   ├── providers/
│   │   └── AuthProvider.tsx
│   ├── navigation/
│   │   └── AppNavigator.tsx
│   ├── App.tsx
├── babel.config.js
├── tailwind.config.js
├── package.json
```

## Core Dependencies
- expo: The foundation framework
- @supabase/supabase-js: Supabase client library
- @react-navigation/native & @react-navigation/native-stack: Navigation
- nativewind: Tailwind CSS for React Native
- @react-native-async-storage/async-storage: Storage for Supabase auth
- react-native-url-polyfill: Required for Supabase in React Native

## Database Schema

### Tables

#### user_profiles
```sql
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users (id) PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    show_profile BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### daily_metric_scores
```sql
CREATE TABLE IF NOT EXISTS public.daily_metric_scores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users (id) NOT NULL,
    date DATE NOT NULL,
    metric_type TEXT NOT NULL,
    goal_reached BOOLEAN DEFAULT FALSE,
    points INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_daily_metric UNIQUE (user_id, date, metric_type)
);
```

#### daily_totals
```sql
CREATE TABLE IF NOT EXISTS public.daily_totals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users (id) NOT NULL,
    date DATE NOT NULL,
    total_points INT DEFAULT 0,
    metrics_completed INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_daily_total UNIQUE (user_id, date)
);
```

### Row Level Security (RLS) Policies

#### user_profiles RLS
```sql
CREATE POLICY "select public or own" ON public.user_profiles
    FOR SELECT USING (
      show_profile = TRUE OR auth.uid() = id
    );
CREATE POLICY "insert/update own" ON public.user_profiles
    FOR ALL USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
```

#### daily_metric_scores RLS
```sql
CREATE POLICY "select own" ON public.daily_metric_scores
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert/update own" ON public.daily_metric_scores
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

#### daily_totals RLS
```sql
CREATE POLICY "select all" ON public.daily_totals
    FOR SELECT USING (true);
CREATE POLICY "insert/update own" ON public.daily_totals
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

## Key Components

### Authentication Flow
1. `AuthProvider`: Manages authentication state and provides auth methods
2. `LoginScreen`: Handles user login with email/password
3. `useAuth` hook: Provides auth context to components

### Metrics System
1. `MetricsDashboardScreen`: Displays user's daily metrics
2. `MetricCard`: Reusable component for displaying metric data
3. `metricsService`: Handles metric data operations with Supabase

### Leaderboard System
1. `LeaderboardScreen`: Displays daily leaderboard
2. `LeaderboardItem`: Component for individual leaderboard entries
3. `leaderboardService`: Manages leaderboard data operations

## Implementation Guidelines

### Setting Up Supabase Client
```typescript
// src/services/supabaseClient.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Authentication Provider Pattern
```typescript
// src/providers/AuthProvider.tsx
export function AuthProvider({ children }) {
  // Manage auth state
  // Provide signIn, signOut methods
  // Handle session persistence
}

// Usage in components
const { session, signIn, signOut } = useAuth();
```

### Metrics Update Flow
1. Collect metric data (steps, distance, calories)
2. Update individual metric scores
3. Calculate and update daily total
4. Refresh leaderboard data

### Data Flow
```
User Action → Update Metric → Update Daily Total → Refresh Leaderboard
```

## Security Considerations
1. All database access is controlled through RLS policies
2. Users can only modify their own data
3. Profile visibility is controlled by show_profile flag
4. Leaderboard entries respect privacy settings

## Setup Instructions
1. Create Supabase project and set up tables with RLS
2. Configure environment variables for Supabase URL and anon key
3. Install dependencies with `yarn install`
4. Run with `yarn expo start`

## Testing Strategy
1. Auth flow testing
2. Metric update validation
3. Leaderboard calculation verification
4. Privacy settings enforcement

## Performance Considerations
1. Minimize unnecessary re-renders
2. Batch metric updates
3. Cache leaderboard data
4. Implement proper error boundaries

## Future Enhancements
1. Social features
2. Achievement system
3. Historical data visualization
4. Team competitions
5. Integration with health platforms