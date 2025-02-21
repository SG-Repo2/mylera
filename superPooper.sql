

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






COMMENT ON SCHEMA "public" IS 'standard public schema';



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


ALTER FUNCTION "public"."calculate_health_score"("p_steps" integer, "p_distance" double precision, "p_calories" integer, "p_heart_rate" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_metric_points"("metric_value" numeric, "metric_type" "text", "measurement_system" "text") RETURNS TABLE("points" integer, "goal_reached" boolean)
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  converted_value numeric;
  target_heart_rate numeric := 75;
  heart_rate_range numeric := 15;
  exercise_goal numeric := 30;
  bonus_points integer := 0;
BEGIN
  -- Ensure measurement_system has a valid value
  IF measurement_system IS NULL OR (measurement_system != 'metric' AND measurement_system != 'imperial') THEN
    measurement_system := 'metric';
  END IF;

  -- Convert imperial measurements if needed
  converted_value := CASE 
    WHEN measurement_system = 'imperial' AND metric_type = 'distance' 
    THEN metric_value * 1609.34  -- miles to meters
    ELSE metric_value
  END;

  -- Validate metric value
  IF converted_value IS NULL OR converted_value < 0 THEN
    converted_value := 0;
  END IF;

  -- Calculate points based on metric type
  CASE metric_type
    WHEN 'heart_rate' THEN
      -- Heart rate points: max 30 points, scaled by distance from target
      IF converted_value BETWEEN (target_heart_rate - heart_rate_range) AND (target_heart_rate + heart_rate_range) THEN
        points := ROUND(30 * (1 - ABS(converted_value - target_heart_rate) / heart_rate_range));
        goal_reached := true;
      ELSE
        points := 0;
        goal_reached := false;
      END IF;

    WHEN 'exercise' THEN
      -- Exercise points: 1 point per minute up to 30
      points := LEAST(ROUND(converted_value), 30);
      goal_reached := converted_value >= exercise_goal;
      
      -- Add bonus points for exceeding exercise goal (up to 10 extra points)
      IF goal_reached THEN
        bonus_points := LEAST(FLOOR((converted_value - exercise_goal) / 10), 10);
        points := points + bonus_points;
      END IF;

    WHEN 'steps' THEN
      -- Steps points: 1 point per 100 steps up to 100 points
      points := LEAST(FLOOR(converted_value / 100), 100);
      goal_reached := converted_value >= 10000;
      
      -- Add bonus points for exceeding steps goal (up to 25 extra points)
      IF goal_reached THEN
        bonus_points := LEAST(FLOOR((converted_value - 10000) / 1000), 25);
        points := points + bonus_points;
      END IF;

    WHEN 'distance' THEN
      -- Distance points: 1 point per 160.934m (1/10 mile) up to 30 points
      -- 4828m = 3 miles (goal)
      points := LEAST(FLOOR(converted_value / 160.934), 30);
      goal_reached := converted_value >= 4828;
      
      -- Add bonus points for exceeding distance goal (up to 15 extra points)
      IF goal_reached THEN
        bonus_points := LEAST(FLOOR((converted_value - 4828) / 800), 15);
        points := points + bonus_points;
      END IF;

    WHEN 'calories' THEN
      -- Calories points: 1 point per 10 calories up to 50 points
      points := LEAST(FLOOR(converted_value / 10), 50);
      goal_reached := converted_value >= 500;
      
      -- Add bonus points for exceeding calories goal (up to 15 extra points)
      IF goal_reached THEN
        bonus_points := LEAST(FLOOR((converted_value - 500) / 100), 15);
        points := points + bonus_points;
      END IF;

    WHEN 'basal_calories' THEN
      -- Basal calories points: 1 point per 20 calories up to 90 points
      points := LEAST(FLOOR(converted_value / 20), 90);
      goal_reached := converted_value >= 1800;

    WHEN 'flights_climbed' THEN
      -- Flights climbed points: 2 points per flight up to 20 points
      points := LEAST(FLOOR(converted_value * 2), 20);
      goal_reached := converted_value >= 10;
      
      -- Add bonus points for exceeding flights goal (up to 10 extra points)
      IF goal_reached THEN
        bonus_points := LEAST(FLOOR(converted_value - 10), 10);
        points := points + bonus_points;
      END IF;

    ELSE
      points := 0;
      goal_reached := false;
  END CASE;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."calculate_metric_points"("metric_value" numeric, "metric_type" "text", "measurement_system" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  device_type text;
  display_name text;
  measurement_system text;
BEGIN
  RAISE NOTICE 'raw_user_meta_data: %', NEW.raw_user_meta_data;

  -- Check if raw_user_meta_data is null
  IF NEW.raw_user_meta_data IS NOT NULL THEN
    -- Get the device_type from raw_user_meta_data
    device_type := COALESCE(NEW.raw_user_meta_data->>'deviceType', 'OS');
    display_name := COALESCE(NEW.raw_user_meta_data->>'displayName', null);
    measurement_system := COALESCE(NEW.raw_user_meta_data->>'measurementSystem', 'metric');
  ELSE
    -- Set default values if raw_user_meta_data is null
    device_type := 'OS';
    display_name := null;
    measurement_system := 'metric';
  END IF;

  -- Validate the device_type
  IF device_type <> 'OS' AND device_type <> 'fitbit' THEN
    device_type := 'OS'; -- Default to 'OS' if invalid
  END IF;

  -- Validate the measurement_system
  IF measurement_system <> 'metric' AND measurement_system <> 'imperial' THEN
    measurement_system := 'metric'; -- Default to 'metric' if invalid
  END IF;

  RAISE NOTICE 'device_type: %, display_name: %, measurement_system: %', device_type, display_name, measurement_system;

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
    display_name,
    device_type,
    measurement_system,
    false,
    now(),
    now()
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_daily_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update or insert into daily_totals
  INSERT INTO public.daily_totals (
    user_id,
    date,
    total_points,
    metrics_completed,
    is_test_data
  )
  SELECT 
    NEW.user_id,
    NEW.date,
    (SELECT COALESCE(SUM(points), 0) FROM daily_metric_scores WHERE user_id = NEW.user_id AND date = NEW.date),
    (SELECT COUNT(*) FROM daily_metric_scores WHERE user_id = NEW.user_id AND date = NEW.date AND goal_reached = true),
    NEW.is_test_data
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_points = (SELECT COALESCE(SUM(points), 0) FROM daily_metric_scores WHERE user_id = NEW.user_id AND date = NEW.date),
    metrics_completed = (SELECT COUNT(*) FROM daily_metric_scores WHERE user_id = NEW.user_id AND date = NEW.date AND goal_reached = true),
    updated_at = now(),
    is_test_data = NEW.is_test_data;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_daily_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_metric_scores"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  user_measurement_system text;
BEGIN
  -- Get user's measurement system
  SELECT measurement_system INTO user_measurement_system
  FROM user_profiles 
  WHERE id = NEW.user_id;

  -- If measurement system not found, use metric as default
  IF user_measurement_system IS NULL THEN
    user_measurement_system := 'metric';
  END IF;

  -- Calculate points and goal_reached
  SELECT points, goal_reached 
  INTO NEW.points, NEW.goal_reached
  FROM calculate_metric_points(NEW.value, NEW.metric_type, user_measurement_system);
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_metric_scores"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_weekly_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  week_start_date date;
BEGIN
  -- Calculate the start of the week (Sunday) for the given date
  week_start_date := date_trunc('week', NEW.date)::date;
  
  -- Update weekly totals
  INSERT INTO public.weekly_totals (
    user_id,
    week_start,
    total_points,
    metrics_completed,
    is_test_data
  )
  SELECT 
    NEW.user_id,
    week_start_date,
    (SELECT COALESCE(SUM(total_points), 0) FROM daily_totals 
     WHERE user_id = NEW.user_id AND date >= week_start_date AND date < week_start_date + 7),
    (SELECT COALESCE(SUM(metrics_completed), 0) FROM daily_totals 
     WHERE user_id = NEW.user_id AND date >= week_start_date AND date < week_start_date + 7),
    NEW.is_test_data
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    total_points = (SELECT COALESCE(SUM(total_points), 0) FROM daily_totals 
                  WHERE user_id = NEW.user_id AND date >= week_start_date AND date < week_start_date + 7),
    metrics_completed = (SELECT COALESCE(SUM(metrics_completed), 0) FROM daily_totals 
                       WHERE user_id = NEW.user_id AND date >= week_start_date AND date < week_start_date + 7),
    updated_at = now(),
    is_test_data = NEW.is_test_data;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_weekly_totals"() OWNER TO "postgres";

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


CREATE OR REPLACE VIEW "public"."daily_totals_with_rank" AS
 SELECT "dt"."id",
    "dt"."user_id",
    "dt"."date",
    "dt"."total_points",
    "dt"."metrics_completed",
    "dt"."created_at",
    "dt"."updated_at",
    "dt"."is_test_data",
    "rank"() OVER (PARTITION BY "dt"."date" ORDER BY "dt"."total_points" DESC) AS "rank"
   FROM "public"."daily_totals" "dt";


ALTER TABLE "public"."daily_totals_with_rank" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "show_profile" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "device_type" "text" DEFAULT 'OS'::"text",
    "measurement_system" "text" DEFAULT 'metric'::"text",
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



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_totals"
    ADD CONSTRAINT "weekly_totals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_totals"
    ADD CONSTRAINT "weekly_totals_user_id_week_start_key" UNIQUE ("user_id", "week_start");



CREATE INDEX "idx_daily_metric_scores_user_date" ON "public"."daily_metric_scores" USING "btree" ("user_id", "date");



CREATE INDEX "idx_daily_totals_user_date" ON "public"."daily_totals" USING "btree" ("user_id", "date");



CREATE INDEX "idx_user_profiles_id" ON "public"."user_profiles" USING "btree" ("id");



CREATE INDEX "idx_weekly_totals_user_week" ON "public"."weekly_totals" USING "btree" ("user_id", "week_start");



CREATE OR REPLACE TRIGGER "update_daily_totals_trigger" AFTER INSERT OR UPDATE OF "points", "goal_reached" ON "public"."daily_metric_scores" FOR EACH ROW EXECUTE FUNCTION "public"."update_daily_totals"();



CREATE OR REPLACE TRIGGER "update_metric_scores_trigger" BEFORE INSERT OR UPDATE OF "value" ON "public"."daily_metric_scores" FOR EACH ROW EXECUTE FUNCTION "public"."update_metric_scores"();



CREATE OR REPLACE TRIGGER "update_weekly_totals_trigger" AFTER INSERT OR UPDATE OF "total_points", "metrics_completed" ON "public"."daily_totals" FOR EACH ROW EXECUTE FUNCTION "public"."update_weekly_totals"();



ALTER TABLE ONLY "public"."daily_metric_scores"
    ADD CONSTRAINT "daily_metric_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."daily_totals"
    ADD CONSTRAINT "daily_totals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."daily_totals"
    ADD CONSTRAINT "daily_totals_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."weekly_totals"
    ADD CONSTRAINT "weekly_totals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Users can insert their own metric scores" ON "public"."daily_metric_scores" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can modify own daily totals" ON "public"."daily_totals" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can modify own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can modify own weekly totals" ON "public"."weekly_totals" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read daily totals" ON "public"."daily_totals" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "daily_totals"."user_id") AND ("user_profiles"."show_profile" = true))))));



CREATE POLICY "Users can read public profiles" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING ((("show_profile" = true) OR ("auth"."uid"() = "id")));



CREATE POLICY "Users can read their own metric scores" ON "public"."daily_metric_scores" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read weekly totals" ON "public"."weekly_totals" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "weekly_totals"."user_id") AND ("user_profiles"."show_profile" = true))))));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own metric scores" ON "public"."daily_metric_scores" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view public or own profiles" ON "public"."user_profiles" FOR SELECT USING (("show_profile" OR ("auth"."uid"() = "id")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


CREATE PUBLICATION "supabase_realtime_messages_publication" WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION "supabase_realtime_messages_publication" OWNER TO "supabase_admin";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."calculate_health_score"("p_steps" integer, "p_distance" double precision, "p_calories" integer, "p_heart_rate" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_health_score"("p_steps" integer, "p_distance" double precision, "p_calories" integer, "p_heart_rate" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_health_score"("p_steps" integer, "p_distance" double precision, "p_calories" integer, "p_heart_rate" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_metric_points"("metric_value" numeric, "metric_type" "text", "measurement_system" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_metric_points"("metric_value" numeric, "metric_type" "text", "measurement_system" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_metric_points"("metric_value" numeric, "metric_type" "text", "measurement_system" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_daily_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_daily_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_daily_totals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_metric_scores"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_metric_scores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_metric_scores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_weekly_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_weekly_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_weekly_totals"() TO "service_role";


















GRANT ALL ON TABLE "public"."daily_metric_scores" TO "anon";
GRANT ALL ON TABLE "public"."daily_metric_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_metric_scores" TO "service_role";



GRANT ALL ON TABLE "public"."daily_totals" TO "anon";
GRANT ALL ON TABLE "public"."daily_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_totals" TO "service_role";



GRANT ALL ON TABLE "public"."daily_totals_with_rank" TO "anon";
GRANT ALL ON TABLE "public"."daily_totals_with_rank" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_totals_with_rank" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_totals" TO "anon";
GRANT ALL ON TABLE "public"."weekly_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_totals" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
