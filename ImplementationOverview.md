# Implementation Overview

## 2. Final Directory Structure

mylera/
├── assets/
│   ├── images/
│   │   ├── logo.png
│   ├── icons/
│   └── fonts/
├── src/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── screens/
│   │   │   │   └── LoginScreen.tsx
│   │   │   ├── components/
│   │   │   │   └── AuthForm.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts
│   │   │   └── index.ts
│   │   ├── metrics/
│   │   │   ├── screens/
│   │   │   │   └── MetricsDashboardScreen.tsx
│   │   │   ├── components/
│   │   │   │   └── MetricCard.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useMetrics.ts
│   │   │   └── index.ts
│   │   ├── leaderboard/
│   │   │   ├── screens/
│   │   │   │   └── LeaderboardScreen.tsx
│   │   │   ├── components/
│   │   │   │   └── LeaderboardItem.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useLeaderboard.ts
│   │   │   └── index.ts
│   │   └── profile/
│   │       ├── screens/
│   │       │   └── ProfileScreen.tsx
│   │       ├── components/
│   │       │   └── Avatar.tsx
│   │       ├── hooks/
│   │       │   └── useProfile.ts
│   │       └── index.ts
│   ├── navigation/
│   │   ├── AppNavigator.tsx
│   │   └── index.ts
│   ├── services/
│   │   ├── supabaseClient.ts         # Supabase client config
│   │   ├── authService.ts            # Auth-related queries/methods
│   │   ├── metricsService.ts         # Daily metric operations
│   │   ├── leaderboardService.ts     # Leaderboard queries
│   │   └── profileService.ts         # User profile operations
│   ├── providers/
│   │   ├── AuthProvider.tsx          # Provides auth context using Supabase
│   │   └── HealthProvider.tsx        # (Optional) if bridging Apple/Google Health
│   ├── utils/
│   │   ├── formatters.ts
│   │   └── determineLocalDate.ts
│   ├── App.tsx                       # Entry point
│   └── …
├── .env
├── .gitignore
├── app.json
├── app.config.ts (or app.config.js)  # Expo config & plugin settings
├── babel.config.js                   # NativeWind + other Babel plugins
├── metro.config.js
├── tsconfig.json
├── package.json
└── …

**Why This Structure?**  
1. **Separation of Features**: `features/` is grouped by domain (auth, metrics, leaderboard, profile).  
2. **Services**: Dedicated folder for Supabase, health, and other back-end logic.  
3. **Providers**: Context providers (Auth, Health) that wrap the app.  
4. **Navigation**: Houses the app’s navigation structure (e.g. React Navigation or Expo Router).  
5. **Config & Scripts**: Root files like `app.config.ts`, `babel.config.js`, and `.env` keep environment setup clean.

---

## 3. Database Schema (Recap)

- **user_profiles**: Minimal personal info (`display_name`, `avatar_url`, `show_profile` flag).  
- **daily_metric_scores**: Private, granular data for each metric/day (steps, distance, etc.).  
- **daily_totals**: Aggregated points for leaderboards. Publicly viewable but only user-editable.

**Core Benefit**: Raw health data remains private (`daily_metric_scores`) while `daily_totals` powers the leaderboard. Row-Level Security (RLS) ensures HIPAA-like separation of personal data from public info.

If you haven’t already, run the SQL migrations proposed below (creating `user_profiles`, `daily_metric_scores`, `daily_totals`, plus triggers and RLS policies) in your Supabase instance.

---

## 4. Merged Implementation Highlights

Below are key code snippets that combine the best parts from the **webExport**, **reactNativeExport**, and **combo** proposals. Adjust or refactor as needed for your final MVP.

### 4.1 Tailwind & NativeWind Setup

<details>
<summary><code>tailwind.config.js</code></summary>

```js
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#20B2AA",
        secondary: "#9B59B6",
        background: "#f9f9f9",
      },
    },
  },
  plugins: [],
};

</details>


<details>
<summary><code>babel.config.js</code></summary>


module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["nativewind/babel"],
  };
};

</details>


4.2 Supabase Client (services/supabaseClient.ts)

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

4.3 Auth Provider (providers/AuthProvider.tsx)

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

4.4 Metric Services (services/metricsService.ts)

import { supabase } from './supabaseClient';

export async function updateDailyMetricScore(userId: string, metricType: string, goalReached: boolean) {
  const dateStr = new Date().toISOString().split('T')[0];
  const points = goalReached ? 25 : 0;

  const { error } = await supabase
    .from('daily_metric_scores')
    .upsert({
      user_id: userId,
      date: dateStr,
      metric_type: metricType,
      goal_reached: goalReached,
      points
    }, {
      onConflict: 'user_id,date,metric_type'
    });

  if (error) throw error;
}

export async function updateDailyTotal(userId: string) {
  const dateStr = new Date().toISOString().split('T')[0];

  // Sum of all points for the day
  const { data: scores, error: fetchErr } = await supabase
    .from('daily_metric_scores')
    .select('points')
    .match({ user_id: userId, date: dateStr });
  
  if (fetchErr) throw fetchErr;

  const totalPoints = scores?.reduce((sum, item) => sum + (item.points || 0), 0) ?? 0;
  const metricsCompleted = scores?.filter(item => item.points > 0).length ?? 0;

  const { error: upsertErr } = await supabase
    .from('daily_totals')
    .upsert({
      user_id: userId,
      date: dateStr,
      total_points: totalPoints,
      metrics_completed: metricsCompleted
    }, {
      onConflict: 'user_id,date'
    });

  if (upsertErr) throw upsertErr;
}

4.5 MetricCard (React Native) (features/metrics/components/MetricCard.tsx)

import { View, Text, Pressable } from 'react-native';
import { styled } from 'nativewind';

const SView = styled(View);
const SText = styled(Text);
const SPressable = styled(Pressable);

interface MetricCardProps {
  title: string;
  value: number;
  goal: number;
  points: number;
  unit: string;
  onPress?: () => void;
}

export function MetricCard({ title, value, goal, points, unit, onPress }: MetricCardProps) {
  const progress = Math.min((value / goal) * 100, 100);

  return (
    <SPressable onPress={onPress} className="bg-primary rounded-xl p-4 m-2">
      <SView className="flex-row justify-between mb-3">
        <SText className="text-white font-medium">{title}</SText>
        <SText className="text-white/70 text-sm">{points} pts</SText>
      </SView>

      <SView>
        <SView className="flex-row items-baseline space-x-1 mb-2">
          <SText className="text-white text-2xl font-bold">
            {value.toLocaleString()}
          </SText>
          <SText className="text-white text-base">{unit}</SText>
        </SView>

        <SView className="bg-white/20 w-full h-2 rounded-full">
          <SView
            className="bg-white h-full rounded-full"
            style={{ width: `${progress}%` }}
          />
        </SView>
      </SView>
    </SPressable>
  );
}

4.6 Leaderboard

services/leaderboardService.ts

import { supabase } from './supabaseClient';

export async function getLeaderboard(date = new Date().toISOString().split('T')[0]) {
  // Only showing daily totals for the given date
  const { data, error } = await supabase
    .from('daily_totals')
    .select(`
      user_id,
      total_points,
      user_profiles (
        display_name,
        avatar_url,
        show_profile
      )
    `)
    .eq('date', date)
    .order('total_points', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

features/leaderboard/screens/LeaderboardScreen.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { getLeaderboard } from '@/services/leaderboardService';

export function LeaderboardScreen() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getLeaderboard();
        setEntries(data || []);
      } catch (e) {
        console.error('Leaderboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <ActivityIndicator />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Leaderboard</Text>
      <FlatList
        data={entries}
        keyExtractor={(item, index) => `${item.user_id}-${index}`}
        renderItem={({ item, index }) => {
          const { display_name, avatar_url, show_profile } = item.user_profiles || {};
          const nameToShow = show_profile ? display_name : 'Anonymous';
          return (
            <View style={styles.item}>
              <Text style={styles.rank}>{index + 1}.</Text>
              <Text style={styles.name}>{nameToShow ?? 'Anonymous'}</Text>
              <Text style={styles.score}>{item.total_points} pts</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rank: { fontSize: 16, width: 30 },
  name: { fontSize: 16, flex: 1 },
  score: { fontSize: 16, fontWeight: '600' },
});

6. Putting It All Together

6.1 App Entry: App.tsx

import React from 'react';
import { AuthProvider } from '@/providers/AuthProvider';
import { AppNavigator } from '@/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

6.2 Navigation: navigation/AppNavigator.tsx

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { MetricsDashboardScreen } from '@/features/metrics/screens/MetricsDashboardScreen';
import { LeaderboardScreen } from '@/features/leaderboard/screens/LeaderboardScreen';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="MetricsDashboard" component={MetricsDashboardScreen} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

6.3 Metrics Flow Example

// src/features/metrics/screens/MetricsDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Button } from 'react-native';
import { MetricCard } from '../components/MetricCard';
import { useAuth } from '@/providers/AuthProvider';
import { updateDailyMetricScore, updateDailyTotal } from '@/services/metricsService';

export function MetricsDashboardScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  
  // Example local states (normally from device or hooks)
  const [steps, setSteps] = useState(6000);
  const [distance, setDistance] = useState(3.2); // miles
  const [calories, setCalories] = useState(1800);

  const handleSyncData = async () => {
    if (!userId) return;
    await updateDailyMetricScore(userId, 'steps', steps >= 10000);
    await updateDailyMetricScore(userId, 'distance', distance >= 3);
    await updateDailyMetricScore(userId, 'calories', calories >= 2000);
    await updateDailyTotal(userId);
  };

  useEffect(() => {
    // Possibly fetch from Apple/Google Health on mount, then set states
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Your Metrics</Text>
        
        <MetricCard
          title="Steps"
          value={steps}
          goal={10000}
          points={steps >= 10000 ? 25 : 0}
          unit="steps"
        />
        <MetricCard
          title="Distance"
          value={distance}
          goal={3}
          points={distance >= 3 ? 25 : 0}
          unit="miles"
        />
        <MetricCard
          title="Calories"
          value={calories}
          goal={2000}
          points={calories >= 2000 ? 25 : 0}
          unit="kcal"
        />
        
        {/* Sync button */}
        <Button title="Sync and Update Scores" onPress={handleSyncData} />
      </View>
    </ScrollView>
  );
}

6.4 Profile Management (Optional)
    •    profileService.ts for CRUD operations on user_profiles.
    •    ProfileScreen.tsx to let users toggle show_profile or set an avatar.

7. Database Schema and Configuration

To ensure HIPAA-like compliance and data privacy, implement the following database schema, triggers, and Row-Level Security (RLS) policies in your Supabase instance.

7.1 SQL Schema DDL

<details>
<summary><strong>Complete DDL with RLS Policies</strong></summary>


-- Enable UUID generation in PostgreSQL (needed for default uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

----------------------------------------------------
-- 1. Helper function to auto-update updated_at
----------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

----------------------------------------------------
-- 2. Helper function to generate default display_name
----------------------------------------------------
CREATE OR REPLACE FUNCTION generate_default_display_name()
RETURNS trigger AS $$
BEGIN
    IF NEW.display_name IS NULL THEN
        NEW.display_name := 'User' || substr(gen_random_uuid()::text, 1, 8);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

----------------------------------------------------
-- 3. user_profiles table
----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users (id) PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    show_profile BOOLEAN DEFAULT FALSE,
    -- optionally: add a unit_preference column if needed:
    -- unit_preference TEXT CHECK (unit_preference IN ('imperial', 'metric')) DEFAULT 'imperial',

    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger: set default display_name on insert
CREATE TRIGGER set_default_display_name
BEFORE INSERT ON public.user_profiles
FOR EACH ROW
EXECUTE PROCEDURE generate_default_display_name();

-- Trigger: auto-update the updated_at timestamp on update
CREATE TRIGGER set_timestamp_profiles
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

----------------------------------------------------
-- 4. daily_metric_scores table
----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_metric_scores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users (id) NOT NULL,
    date DATE DEFAULT current_date NOT NULL,
    metric_type TEXT NOT NULL,
    goal_reached BOOLEAN DEFAULT FALSE,
    points INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT valid_metric_type CHECK (
        metric_type IN ('steps', 'calories', 'distance', 'heart_rate', 'exercise', 'standing')
    ),
    CONSTRAINT unique_daily_metric UNIQUE (user_id, date, metric_type)
);

-- Trigger: auto-update updated_at on update
CREATE TRIGGER set_timestamp_metrics
BEFORE UPDATE ON public.daily_metric_scores
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

----------------------------------------------------
-- 5. daily_totals table
----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_totals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users (id) NOT NULL,
    date DATE DEFAULT current_date NOT NULL,
    total_points INTEGER DEFAULT 0,
    metrics_completed INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT unique_daily_total UNIQUE (user_id, date)
);

-- Trigger: auto-update updated_at on update
CREATE TRIGGER set_timestamp_totals
BEFORE UPDATE ON public.daily_totals
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

----------------------------------------------------
-- 6. Indexes
----------------------------------------------------
-- For quick lookups of user/day combos in daily_metric_scores
CREATE INDEX IF NOT EXISTS idx_daily_metric_scores_user_date
    ON public.daily_metric_scores (user_id, date);

-- For leaderboard queries by total_points
CREATE INDEX IF NOT EXISTS idx_daily_totals_date_points
    ON public.daily_totals (date, total_points DESC);

-- For faster user profile lookups by show_profile
CREATE INDEX IF NOT EXISTS idx_user_profiles_show_profile
    ON public.user_profiles (show_profile);

----------------------------------------------------
-- 7. Row-Level Security (RLS)
----------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metric_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_totals ENABLE ROW LEVEL SECURITY;

-- user_profiles RLS Policies
CREATE POLICY "Users can view public or their own profile"
    ON public.user_profiles
    FOR SELECT
    USING (
        show_profile = TRUE
        OR auth.uid() = id
    );

CREATE POLICY "Users can insert/update their own profile"
    ON public.user_profiles
    FOR ALL
    USING (
        auth.uid() = id
    )
    WITH CHECK (
        auth.uid() = id
    );

-- daily_metric_scores RLS Policies
CREATE POLICY "Users can view their own daily metric scores"
    ON public.daily_metric_scores
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update their own daily metric scores"
    ON public.daily_metric_scores
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
    );

-- daily_totals RLS Policies
CREATE POLICY "Anyone can select daily totals"
    ON public.daily_totals
    FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can insert/update their own daily totals"
    ON public.daily_totals
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
    );

</details>


7.2 Optional: Streak-Tracking Function

If you decide to implement streak tracking in the future, add the following PostgreSQL function:

CREATE OR REPLACE FUNCTION get_metric_streaks(
    p_user_id UUID,
    p_metric_type TEXT,
    p_min_streak_length INT DEFAULT 2
)
RETURNS TABLE (
    streak_start DATE,
    streak_end DATE,
    streak_length INT,
    is_active BOOLEAN
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH daily_results AS (
        -- Only select days where the user actually reached the goal
        SELECT 
            date,
            goal_reached,
            date - (ROW_NUMBER() OVER (ORDER BY date))::INTEGER AS grp
        FROM daily_metric_scores
        WHERE user_id = p_user_id
          AND metric_type = p_metric_type
          AND goal_reached = TRUE
        ORDER BY date
    ),
    streaks AS (
        SELECT 
            MIN(date) AS streak_start,
            MAX(date) AS streak_end,
            COUNT(*) AS streak_length,
            MAX(date) = current_date AS is_active
        FROM daily_results
        GROUP BY grp
        HAVING COUNT(*) >= p_min_streak_length
        ORDER BY MIN(date) DESC
    )
    SELECT * FROM streaks;
END;
$$;

8. Recommended Client-Side Logic (TypeScript)

8.1 Upserting Metric Scores

import { supabase } from '../services/supabaseClient';
import { MetricType } from './types';

export const updateMetrics = async (
  userId: string,
  metricType: MetricType,
  goalReached: boolean
) => {
  const dateStr = new Date().toISOString().split('T')[0];
  const points = goalReached ? 25 : 0;

  const { data, error } = await supabase
    .from('daily_metric_scores')
    .upsert(
      {
        user_id: userId,
        date: dateStr,
        metric_type: metricType,
        goal_reached: goalReached,
        points
      },
      {
        onConflict: 'user_id,date,metric_type'
      }
    );

  if (error) {
    console.error('Error updating metric:', error);
  }
  return data;
};

8.2 Summing and Storing daily_totals

export const updateDailyTotal = async (userId: string) => {
  const dateStr = new Date().toISOString().split('T')[0];

  // Fetch all the user's metric scores for today
  const { data: metrics, error: metricsError } = await supabase
    .from('daily_metric_scores')
    .select('points')
    .eq('user_id', userId)
    .eq('date', dateStr);

  if (metricsError) {
    console.error('Error fetching metrics:', metricsError);
    return;
  }

  // Sum points and count how many metrics were completed
  const totalPoints = metrics?.reduce((sum, m) => sum + m.points, 0) ?? 0;
  const metricsCompleted = metrics?.filter(m => m.points > 0).length ?? 0;

  // Upsert into daily_totals
  const { data: upsertData, error: totalsError } = await supabase
    .from('daily_totals')
    .upsert(
      {
        user_id: userId,
        date: dateStr,
        total_points: totalPoints,
        metrics_completed: metricsCompleted
      },
      {
        onConflict: 'user_id,date'
      }
    );

  if (totalsError) {
    console.error('Error updating daily totals:', totalsError);
  }
  return upsertData;
};

8.3 Leaderboard Query Example

export const fetchLeaderboard = async () => {
  const dateStr = new Date().toISOString().split('T')[0];
  return supabase
    .from('daily_totals')
    .select(`
      user_id,
      total_points,
      user_profiles (
        display_name,
        avatar_url,
        show_profile
      )
    `)
    .eq('date', dateStr)
    .order('total_points', { ascending: false })
    .limit(50);

  // On the client side, decide whether to display "Anonymous" if show_profile=false
};

8.4 Optional: Streak Function Usage

export const getMetricStreaks = async (userId: string, metricType: MetricType) => {
  const { data, error } = await supabase
    .rpc('get_metric_streaks', {
      p_user_id: userId,
      p_metric_type: metricType,
      p_min_streak_length: 2
    });

  if (error) {
    console.error('Error fetching streaks:', error);
    return [];
  }

  return data; // returns an array of { streak_start, streak_end, streak_length, is_active }
};

9. Summary
    1.    Project Structure: You have a clear, maintainable layout where each feature (auth, metrics, leaderboard, profile) has its own folder under src/features/.
    2.    Database: Three main tables—user_profiles, daily_metric_scores, daily_totals—secured by RLS. This ensures HIPAA-like compliance for sensitive data while enabling a public leaderboard on aggregated totals.
    3.    UI Components: Key components (MetricCard, LeaderboardItem) live in the respective components/ folders. They are adapted for React Native + NativeWind styling.
    4.    Services: services/ contains logic to interact with Supabase (e.g., metricsService, leaderboardService).
    5.    Providers: AuthProvider (and optionally HealthProvider) wrap your app to provide global states.
    6.    Extendable: You can add achievements, streak-tracking, weekly totals, or more complex metric logic later without major restructuring.

This single reference aims to keep your codebase organized and consistent while delivering the core functionalities from all three proposals (web UI patterns, React Native health integration, and a combined architecture) in one Expo project.

---

### Tips for Using this Document

- Keep this `.md` file in your repo (e.g., `docs/ImplementationOverview.md`) so everyone on your team can follow the same structure and code guidelines.
- As you evolve the codebase (e.g., adding new metrics or building achievements), **update** this doc so it stays aligned with your actual implementation.
- Test each snippet to confirm you’ve adjusted import paths (`@/services`, `@/providers`, etc.) to match **your** setup.  

**You’re all set!** This final markdown provides a **one-stop guide** for your combined architecture, ensuring that the Next.js/Tailwind UI patterns, React Native health integration, and your Supabase backend all work together smoothly.
