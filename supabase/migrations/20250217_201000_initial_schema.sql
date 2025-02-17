-- Migration: 20250217_201000_initial_schema.sql
-- Description: Create initial schema including tables, functions, and basic indexes
-- Dependencies: 20250217_200000_publication_extensions.sql

-- Create functions
CREATE OR REPLACE FUNCTION public.calculate_health_score(p_steps integer, p_distance double precision, p_calories integer, p_heart_rate integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_steps_score INTEGER;
  v_distance_score INTEGER;
  v_calories_score INTEGER;
  v_heart_rate_score INTEGER;
  v_total_score INTEGER;
BEGIN
  -- Steps score calculation
  IF p_steps >= 10000 THEN
    v_steps_score := 100;
  ELSIF p_steps >= 5000 THEN
    v_steps_score := 50 + ROUND((p_steps - 5000)::FLOAT / 5000 * 50);
  ELSIF p_steps > 0 THEN
    v_steps_score := ROUND((p_steps::FLOAT / 5000) * 50);
  ELSE
    v_steps_score := 0;
  END IF;

  -- Distance score calculation
  IF p_distance >= 8.05 THEN
    v_distance_score := 100;
  ELSIF p_distance >= 4.0 THEN
    v_distance_score := 50 + ROUND((p_distance - 4.0) / 4.05 * 50);
  ELSIF p_distance > 0 THEN
    v_distance_score := ROUND((p_distance / 4.0) * 50);
  ELSE
    v_distance_score := 0;
  END IF;

  -- Calories score calculation
  IF p_calories >= 500 THEN
    v_calories_score := 100;
  ELSIF p_calories >= 300 THEN
    v_calories_score := 50 + ROUND((p_calories - 300)::FLOAT / 200 * 50);
  ELSIF p_calories > 0 THEN
    v_calories_score := ROUND((p_calories::FLOAT / 300) * 50);
  ELSE
    v_calories_score := 0;
  END IF;

  -- Heart rate score calculation
  IF p_heart_rate BETWEEN 60 AND 100 THEN
    v_heart_rate_score := 100;
  ELSE
    v_heart_rate_score := 0;
  END IF;

  -- Calculate weighted average
  v_total_score := ROUND(
    v_steps_score * 0.3 +
    v_distance_score * 0.3 +
    v_calories_score * 0.2 +
    v_heart_rate_score * 0.2
  );

  RETURN v_total_score;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_metric_points(metric_value numeric, metric_type text, measurement_system text)
RETURNS TABLE(points integer, goal_reached boolean)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  converted_value numeric;
  target_heart_rate numeric := 75;
  heart_rate_range numeric := 15;
  exercise_goal numeric := 30;
BEGIN
  -- Convert imperial measurements if needed
  converted_value := CASE 
    WHEN measurement_system = 'imperial' AND metric_type = 'distance' 
    THEN metric_value * 1609.34  -- miles to meters
    ELSE metric_value
  END;

  -- Calculate points based on metric type
  CASE metric_type
    WHEN 'heart_rate' THEN
      IF converted_value BETWEEN (target_heart_rate - heart_rate_range) AND (target_heart_rate + heart_rate_range) THEN
        points := ROUND(30 * (1 - ABS(converted_value - target_heart_rate) / heart_rate_range));
        goal_reached := true;
      ELSE
        points := 0;
        goal_reached := false;
      END IF;

    WHEN 'exercise' THEN
      points := LEAST(ROUND(converted_value), 30);
      goal_reached := converted_value >= exercise_goal;

    WHEN 'steps' THEN
      points := LEAST(FLOOR(converted_value / 100), 100);
      goal_reached := converted_value >= 10000;

    WHEN 'distance' THEN
      points := LEAST(FLOOR(converted_value / 160.934), 30);
      goal_reached := converted_value >= 4828;

    WHEN 'calories' THEN
      points := LEAST(FLOOR(converted_value / 10), 50);
      goal_reached := converted_value >= 500;

    WHEN 'basal_calories' THEN
      points := LEAST(FLOOR(converted_value / 20), 90);
      goal_reached := converted_value >= 1800;

    WHEN 'flights_climbed' THEN
      points := LEAST(FLOOR(converted_value * 2), 20);
      goal_reached := converted_value >= 10;

    ELSE
      points := 0;
      goal_reached := false;
  END CASE;

  RETURN NEXT;
END;
$$;

-- Create tables
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id),
    display_name text,
    avatar_url text,
    show_profile boolean DEFAULT false,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    device_type text DEFAULT 'OS'::text,
    measurement_system text DEFAULT 'metric'::text,
    CONSTRAINT user_profiles_device_type_check CHECK (device_type = ANY (ARRAY['OS'::text, 'fitbit'::text])),
    CONSTRAINT user_profiles_measurement_system_check CHECK (measurement_system = ANY (ARRAY['imperial'::text, 'metric'::text]))
);

CREATE TABLE IF NOT EXISTS public.daily_metric_scores (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    date date DEFAULT CURRENT_DATE NOT NULL,
    metric_type text NOT NULL,
    goal_reached boolean DEFAULT false,
    points integer DEFAULT 0,
    value numeric,
    goal numeric,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_test_data boolean DEFAULT false,
    CONSTRAINT daily_metric_scores_metric_type_check CHECK (metric_type = ANY (ARRAY['steps'::text, 'distance'::text, 'calories'::text, 'heart_rate'::text, 'exercise'::text, 'basal_calories'::text, 'flights_climbed'::text])),
    CONSTRAINT daily_metric_scores_value_check CHECK (value >= 0),
    UNIQUE(user_id, date, metric_type)
);

CREATE TABLE IF NOT EXISTS public.daily_totals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    total_points integer DEFAULT 0,
    metrics_completed integer DEFAULT 0,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_test_data boolean DEFAULT false,
    FOREIGN KEY (user_id) REFERENCES auth.users(id),
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id),
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.weekly_totals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    week_start date NOT NULL,
    total_points integer DEFAULT 0,
    metrics_completed integer DEFAULT 0,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_test_data boolean DEFAULT false,
    UNIQUE(user_id, week_start)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_metric_scores_user_date ON public.daily_metric_scores(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_totals_user_date ON public.daily_totals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);

-- Create view for leaderboard
CREATE OR REPLACE VIEW public.daily_totals_with_rank AS
SELECT dt.*, 
       rank() OVER (PARTITION BY dt.date ORDER BY dt.total_points DESC) as rank
FROM public.daily_totals dt;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
