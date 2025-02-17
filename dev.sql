

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";








ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calculate_health_score"("p_steps" integer, "p_distance" double precision, "p_calories" integer, "p_heart_rate" integer) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
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

  -- Calculate weighted average (matching client-side weights)
  v_total_score := ROUND(
    v_steps_score * 0.3 +
    v_distance_score * 0.3 +
    v_calories_score * 0.2 +
    v_heart_rate_score * 0.2
  );

  RETURN v_total_score;
END;
$$;


ALTER FUNCTION "public"."calculate_health_score"("p_steps" integer, "p_distance" double precision, "p_calories" integer, "p_heart_rate" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_metric_points"("metric_value" numeric, "metric_type" "text", "measurement_system" "text") RETURNS TABLE("points" integer, "goal_reached" boolean)
    LANGUAGE "plpgsql" IMMUTABLE
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


ALTER FUNCTION "public"."calculate_metric_points"("metric_value" numeric, "metric_type" "text", "measurement_system" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_auth_user_exists"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE id = user_id
    );
END;
$$;


ALTER FUNCTION "public"."check_auth_user_exists"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_profile"("p_user_id" "uuid", "p_display_name" "text", "p_device_type" "text", "p_measurement_system" "text", "p_avatar_url" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    display_name,
    device_type,
    measurement_system,
    avatar_url,
    show_profile,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_display_name,
    p_device_type,
    p_measurement_system,
    p_avatar_url,
    false,
    now(),
    now()
  );
END;
$$;


ALTER FUNCTION "public"."create_user_profile"("p_user_id" "uuid", "p_display_name" "text", "p_device_type" "text", "p_measurement_system" "text", "p_avatar_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_auth_user_exists"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE id = NEW.id
    ) THEN
        RAISE EXCEPTION 'Auth user must exist before creating profile'
            USING HINT = 'Wait for auth record to propagate',
                  ERRCODE = '23503';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_auth_user_exists"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_default_display_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.display_name IS NULL THEN
        NEW.display_name := 'User' || substr(gen_random_uuid()::text, 1, 8);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_default_display_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_metric_streaks"("p_user_id" "uuid", "p_metric_type" "text", "p_min_streak_length" integer DEFAULT 2) RETURNS TABLE("streak_start" "date", "streak_end" "date", "streak_length" integer, "is_active" boolean)
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."get_metric_streaks"("p_user_id" "uuid", "p_metric_type" "text", "p_min_streak_length" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_week_start"("date_input" "date") RETURNS "date"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    RETURN date_trunc('week', date_input)::date;
END;
$$;


ALTER FUNCTION "public"."get_week_start"("date_input" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_profiles (id, device_type, measurement_system)
  VALUES (NEW.id, 'OS', 'metric')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_health_metric_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.health_metrics_history (
            metric_id, user_id, date, steps, distance, calories, heart_rate,
            daily_score, weekly_score, streak_days, version, change_type,
            changed_by, device_id, source
        ) VALUES (
            NEW.id, NEW.user_id, NEW.date, NEW.steps, NEW.distance, NEW.calories,
            NEW.heart_rate, NEW.daily_score, NEW.weekly_score, NEW.streak_days,
            1, 'INSERT', auth.uid(),
            current_setting('app.device_id', true),
            current_setting('app.source', true)
        );
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        IF (NEW.steps != OLD.steps 
            OR NEW.distance != OLD.distance 
            OR NEW.calories != OLD.calories 
            OR NEW.heart_rate != OLD.heart_rate
            OR NEW.daily_score != OLD.daily_score
            OR NEW.weekly_score != OLD.weekly_score
            OR NEW.streak_days != OLD.streak_days) THEN

            NEW.version := OLD.version + 1;
            NEW.updated_at := now();
            
            INSERT INTO public.health_metrics_history (
                metric_id, user_id, date, steps, distance, calories, heart_rate,
                daily_score, weekly_score, streak_days, version, change_type,
                changed_by, device_id, source
            ) VALUES (
                NEW.id, NEW.user_id, NEW.date, NEW.steps, NEW.distance, NEW.calories,
                NEW.heart_rate, NEW.daily_score, NEW.weekly_score, NEW.streak_days,
                NEW.version, 'UPDATE', auth.uid(),
                current_setting('app.device_id', true),
                current_setting('app.source', true)
            );
        END IF;
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.health_metrics_history (
            metric_id, user_id, date, steps, distance, calories, heart_rate,
            daily_score, weekly_score, streak_days, version, change_type,
            changed_by, device_id, source
        ) VALUES (
            OLD.id, OLD.user_id, OLD.date, OLD.steps, OLD.distance, OLD.calories,
            OLD.heart_rate, OLD.daily_score, OLD.weekly_score, OLD.streak_days,
            OLD.version, 'DELETE', auth.uid(),
            current_setting('app.device_id', true),
            current_setting('app.source', true)
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."track_health_metric_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_daily_ranks"("target_date" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update daily_score based on ranking
  WITH ranked_metrics AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY daily_score DESC) as rank_position
    FROM health_metrics
    WHERE date = target_date
  )
  UPDATE health_metrics hm
  SET daily_score = 100 - LEAST((rm.rank_position - 1) * 5, 100)  -- Score decreases by 5 for each rank, minimum 0
  FROM ranked_metrics rm
  WHERE hm.id = rm.id
    AND hm.date = target_date;
END;
$$;


ALTER FUNCTION "public"."update_daily_ranks"("target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_metric_points"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.goal IS NOT NULL AND NEW.value IS NOT NULL THEN
        NEW.points := LEAST(FLOOR((NEW.value / NEW.goal) * 100), 100);
    ELSE
        NEW.points := 0;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_metric_points"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_metric_scores"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."update_metric_scores"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_avatar"("p_user_id" "uuid", "p_avatar_url" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.user_profiles
  SET 
    avatar_url = p_avatar_url,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."update_profile_avatar"("p_user_id" "uuid", "p_avatar_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_weekly_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.weekly_totals (
        user_id, week_start, total_points, metrics_completed
    )
    VALUES (
        NEW.user_id,
        get_week_start(NEW.date),
        (
            SELECT COALESCE(SUM(total_points), 0)
            FROM daily_totals
            WHERE user_id = NEW.user_id
            AND date >= get_week_start(NEW.date)
            AND date <= NEW.date
        ),
        NEW.metrics_completed
    )
    ON CONFLICT (user_id, week_start) 
    DO UPDATE SET
        total_points = EXCLUDED.total_points,
        metrics_completed = GREATEST(weekly_totals.metrics_completed, EXCLUDED.metrics_completed),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_weekly_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_weekly_totals_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RAISE NOTICE 'Trigger update_weekly_totals_trigger running as user: %', auth.uid(); -- **ADD THIS LOGGING (CRITICAL)**
    -- ... (rest of trigger code) ...
END;
$$;


ALTER FUNCTION "public"."update_weekly_totals_trigger"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."daily_metric_scores" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "metric_type" "text" NOT NULL,
    "goal_reached" boolean DEFAULT false,
    "points" integer DEFAULT 0,
    "value" numeric,
    "goal" numeric,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_test_data" boolean DEFAULT false,
    CONSTRAINT "daily_metric_scores_metric_type_check" CHECK (("metric_type" = ANY (ARRAY['steps'::"text", 'distance'::"text", 'calories'::"text", 'heart_rate'::"text", 'exercise'::"text", 'basal_calories'::"text", 'flights_climbed'::"text"]))),
    CONSTRAINT "daily_metric_scores_value_check" CHECK (("value" >= (0)::numeric))
);


ALTER TABLE "public"."daily_metric_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_totals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "total_points" integer DEFAULT 0,
    "metrics_completed" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_test_data" boolean DEFAULT false
);


ALTER TABLE "public"."daily_totals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."health_metrics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "steps" integer,
    "distance" numeric,
    "calories" integer,
    "heart_rate" integer,
    "exercise" integer,
    "basal_calories" integer,
    "flights_climbed" integer,
    "daily_score" integer DEFAULT 0,
    "weekly_score" integer,
    "streak_days" integer,
    "version" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."health_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."health_metrics_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "metric_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "steps" integer,
    "distance" numeric,
    "calories" integer,
    "heart_rate" integer,
    "daily_score" integer,
    "weekly_score" integer,
    "streak_days" integer,
    "version" integer NOT NULL,
    "change_type" "text" NOT NULL,
    "changed_by" "uuid",
    "device_id" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."health_metrics_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "show_profile" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "device_type" "text",
    "measurement_system" "text",
    CONSTRAINT "user_profiles_device_type_check" CHECK (("device_type" = ANY (ARRAY['OS'::"text", 'fitbit'::"text"]))),
    CONSTRAINT "user_profiles_measurement_system_check" CHECK (("measurement_system" = ANY (ARRAY['imperial'::"text", 'metric'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_totals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "week_start" "date" NOT NULL,
    "total_points" integer DEFAULT 0,
    "metrics_completed" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_test_data" boolean DEFAULT false
);


ALTER TABLE "public"."weekly_totals" OWNER TO "postgres";


ALTER TABLE ONLY "public"."daily_metric_scores"
    ADD CONSTRAINT "daily_metric_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_metric_scores"
    ADD CONSTRAINT "daily_metric_scores_user_id_date_metric_type_key" UNIQUE ("user_id", "date", "metric_type");



ALTER TABLE ONLY "public"."daily_totals"
    ADD CONSTRAINT "daily_totals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_totals"
    ADD CONSTRAINT "daily_totals_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."health_metrics_history"
    ADD CONSTRAINT "health_metrics_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."health_metrics"
    ADD CONSTRAINT "health_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."health_metrics"
    ADD CONSTRAINT "health_metrics_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_totals"
    ADD CONSTRAINT "weekly_totals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_totals"
    ADD CONSTRAINT "weekly_totals_user_id_week_start_key" UNIQUE ("user_id", "week_start");



CREATE INDEX "idx_daily_metric_scores_user_date" ON "public"."daily_metric_scores" USING "btree" ("user_id", "date");



CREATE INDEX "idx_daily_totals_user_date" ON "public"."daily_totals" USING "btree" ("user_id", "date");



CREATE OR REPLACE TRIGGER "set_default_display_name" BEFORE INSERT ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."generate_default_display_name"();



CREATE OR REPLACE TRIGGER "set_timestamp_metrics" BEFORE UPDATE ON "public"."daily_metric_scores" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_timestamp_profiles" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_timestamp_totals" BEFORE UPDATE ON "public"."daily_totals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_metric_scores_trigger" BEFORE INSERT OR UPDATE OF "value" ON "public"."daily_metric_scores" FOR EACH ROW EXECUTE FUNCTION "public"."update_metric_scores"();



CREATE OR REPLACE TRIGGER "update_weekly_totals_trigger" AFTER INSERT OR UPDATE ON "public"."daily_totals" FOR EACH ROW EXECUTE FUNCTION "public"."update_weekly_totals"();



ALTER TABLE ONLY "public"."daily_metric_scores"
    ADD CONSTRAINT "daily_metric_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."daily_totals"
    ADD CONSTRAINT "daily_totals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."daily_totals"
    ADD CONSTRAINT "daily_totals_user_profile_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."health_metrics_history"
    ADD CONSTRAINT "health_metrics_history_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "public"."health_metrics"("id");



ALTER TABLE ONLY "public"."health_metrics"
    ADD CONSTRAINT "health_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."weekly_totals"
    ADD CONSTRAINT "weekly_totals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


CREATE PUBLICATION "supabase_realtime_messages_publication" WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION "supabase_realtime_messages_publication" OWNER TO "supabase_admin";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."check_auth_user_exists"("user_id" "uuid") TO "authenticated";


















GRANT ALL ON TABLE "public"."daily_metric_scores" TO "authenticated";



GRANT ALL ON TABLE "public"."daily_totals" TO "authenticated";



GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."weekly_totals" TO "authenticated";



























RESET ALL;
