

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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, show_profile)
  VALUES (
    new.id,
    'User ' || substr(new.id::text, 1, 8),
    true
  );
  RETURN new;
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


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."daily_metric_scores" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "metric_type" "text" NOT NULL,
    "goal_reached" boolean DEFAULT false,
    "points" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "value" numeric,
    "goal" numeric,
    "is_test_data" boolean DEFAULT false,
    CONSTRAINT "valid_metric_type" CHECK (("metric_type" = ANY (ARRAY['steps'::"text", 'calories'::"text", 'distance'::"text", 'heart_rate'::"text", 'exercise'::"text", 'standing'::"text", 'basal_calories'::"text", 'flights_climbed'::"text"])))
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


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "show_profile" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."daily_metric_scores"
    ADD CONSTRAINT "daily_metric_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_totals"
    ADD CONSTRAINT "daily_totals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_metric_scores"
    ADD CONSTRAINT "unique_daily_metric" UNIQUE ("user_id", "date", "metric_type");



ALTER TABLE ONLY "public"."daily_totals"
    ADD CONSTRAINT "unique_daily_total" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_daily_metric_scores_user_date" ON "public"."daily_metric_scores" USING "btree" ("user_id", "date");



CREATE INDEX "idx_daily_totals_date_points" ON "public"."daily_totals" USING "btree" ("date", "total_points" DESC);



CREATE INDEX "idx_daily_totals_user_date" ON "public"."daily_totals" USING "btree" ("user_id", "date");



CREATE INDEX "idx_user_profiles_show_profile" ON "public"."user_profiles" USING "btree" ("show_profile");



CREATE OR REPLACE TRIGGER "set_default_display_name" BEFORE INSERT ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."generate_default_display_name"();



CREATE OR REPLACE TRIGGER "set_timestamp_metrics" BEFORE UPDATE ON "public"."daily_metric_scores" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_timestamp_profiles" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_timestamp_totals" BEFORE UPDATE ON "public"."daily_totals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."daily_metric_scores"
    ADD CONSTRAINT "daily_metric_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."daily_totals"
    ADD CONSTRAINT "daily_totals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."daily_totals"
    ADD CONSTRAINT "fk_user_profiles" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



CREATE POLICY "Users can modify own daily totals" ON "public"."daily_totals" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND (("is_test_data" = false) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))));



CREATE POLICY "Users can modify own metric scores" ON "public"."daily_metric_scores" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND (("is_test_data" = false) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))));



CREATE POLICY "Users can modify own profile" ON "public"."user_profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can read daily totals" ON "public"."daily_totals" FOR SELECT USING (((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "daily_totals"."user_id") AND ("user_profiles"."show_profile" = true))))) AND (("is_test_data" = false) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))));



CREATE POLICY "Users can read metric scores" ON "public"."daily_metric_scores" FOR SELECT USING (((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "daily_metric_scores"."user_id") AND ("user_profiles"."show_profile" = true))))) AND (("is_test_data" = false) OR (("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"))));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view public or own profiles" ON "public"."user_profiles" FOR SELECT USING ((("show_profile" = true) OR ("auth"."uid"() = "id")));



ALTER TABLE "public"."daily_metric_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_totals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_auth_user_exists"("user_id" "uuid") TO "authenticated";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."daily_metric_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_metric_scores" TO "service_role";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."daily_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_totals" TO "service_role";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



RESET ALL;
