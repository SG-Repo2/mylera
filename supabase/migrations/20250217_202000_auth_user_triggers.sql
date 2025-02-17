-- Migration: 20250217_202000_auth_user_triggers.sql
-- Description: Set up user-related triggers and RLS policies
-- Dependencies: 20250217_201000_initial_schema.sql

-- Create handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  RAISE NOTICE 'raw_user_meta_data: %', NEW.raw_user_meta_data;

  -- Get the deviceType from raw_user_meta_data
  deviceType text := COALESCE(NEW.raw_user_meta_data->>'deviceType', 'OS');
  displayName text := COALESCE(NEW.raw_user_meta_data->>'displayName', null);
  measurementSystem text := COALESCE(NEW.raw_user_meta_data->>'measurementSystem', 'metric');

  -- Validate the deviceType
  IF deviceType <> 'OS' AND deviceType <> 'fitbit' THEN
    deviceType := 'OS'; -- Default to 'OS' if invalid
  END IF;

  -- Validate the measurementSystem
  IF measurementSystem <> 'metric' AND measurementSystem <> 'imperial' THEN
    measurementSystem := 'metric'; -- Default to 'metric' if invalid
  END IF;

  RAISE NOTICE 'deviceType: %, displayName: %, measurementSystem: %', deviceType, displayName, measurementSystem;

  INSERT INTO public.user_profiles (
    id,
    display_name,
    device_type,
    measurement_system,
    show_profile,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    displayName,
    deviceType,
    measurementSystem,
    false,
    now(),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create update_metric_scores function and trigger
CREATE OR REPLACE FUNCTION public.update_metric_scores()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT points, goal_reached 
  INTO NEW.points, NEW.goal_reached
  FROM calculate_metric_points(NEW.value, NEW.metric_type, (
    SELECT measurement_system 
    FROM user_profiles 
    WHERE id = NEW.user_id
  ));
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER update_metric_scores_trigger
BEFORE INSERT OR UPDATE OF value ON public.daily_metric_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_metric_scores();

-- Ensure the trigger is properly attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metric_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_totals ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can read public profiles"
ON public.user_profiles FOR SELECT
TO authenticated
USING (show_profile = true OR auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.user_profiles
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can modify own profile"
ON public.user_profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view public or own profiles"
ON public.user_profiles
FOR SELECT USING (show_profile OR auth.uid() = id);

-- Daily metric scores policies
CREATE POLICY "Users can read their own metric scores"
ON public.daily_metric_scores FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own metric scores"
ON public.daily_metric_scores FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own metric scores"
ON public.daily_metric_scores FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Daily totals policies
CREATE POLICY "Users can read daily totals"
ON public.daily_totals FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = daily_totals.user_id
        AND show_profile = true
    )
);

CREATE POLICY "Users can modify own daily totals"
ON public.daily_totals FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Weekly totals policies
CREATE POLICY "Users can read weekly totals"
ON public.weekly_totals FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = weekly_totals.user_id
        AND show_profile = true
    )
);

CREATE POLICY "Users can modify own weekly totals"
ON public.weekly_totals FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
