-- Trigger function to create or update user profile from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  metadata jsonb;
  display_name text;
  device_type text;
  measurement_system text;
  show_profile boolean;
BEGIN
  -- Extract metadata
  metadata := NEW.raw_user_meta_data;
  
  -- Extract profile data from metadata with proper null handling
  display_name := metadata->>'displayName';
  device_type := metadata->>'deviceType';
  measurement_system := metadata->>'measurementSystem';
  
  -- Default to true if not provided
  show_profile := COALESCE((metadata->>'showProfile')::boolean, true);
  
  -- Default to 'metric' if not provided
  measurement_system := COALESCE(measurement_system, 'metric');
  
  -- Log the extracted values for debugging
  RAISE NOTICE 'Creating user profile for %: display_name=%, device_type=%, system=%', 
    NEW.id, display_name, device_type, measurement_system;
  
  -- Create or update user profile with explicit handling for each field
  BEGIN
    INSERT INTO public.user_profiles (
      id, 
      display_name, 
      device_type, 
      measurement_system, 
      show_profile,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id, 
      display_name,
      COALESCE(device_type, 'os'),
      COALESCE(measurement_system, 'metric'),
      COALESCE(show_profile, true),
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      display_name = CASE WHEN EXCLUDED.display_name IS NOT NULL THEN EXCLUDED.display_name ELSE user_profiles.display_name END,
      device_type = CASE WHEN EXCLUDED.device_type IS NOT NULL THEN EXCLUDED.device_type ELSE user_profiles.device_type END,
      measurement_system = CASE WHEN EXCLUDED.measurement_system IS NOT NULL THEN EXCLUDED.measurement_system ELSE user_profiles.measurement_system END,
      show_profile = CASE WHEN EXCLUDED.show_profile IS NOT NULL THEN EXCLUDED.show_profile ELSE user_profiles.show_profile END,
      updated_at = now();
  EXCEPTION 
    WHEN OTHERS THEN
      RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the triggers are properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
