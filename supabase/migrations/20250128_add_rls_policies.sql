-- Enable Row Level Security
ALTER TABLE daily_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles table
CREATE POLICY "Users can read their own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can read profiles with show_profile true"
  ON user_profiles
  FOR SELECT
  USING (show_profile = true);

CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create policies for daily_totals table
CREATE POLICY "Users can read their own daily totals"
  ON daily_totals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read daily totals of users with public profiles"
  ON daily_totals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = daily_totals.user_id
      AND user_profiles.show_profile = true
    )
  );

CREATE POLICY "Users can insert their own daily totals"
  ON daily_totals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily totals"
  ON daily_totals
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON daily_totals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;

-- Create default profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, show_profile)
  VALUES (
    new.id,
    'User ' || substr(new.id::text, 1, 8),
    true
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_totals_user_date
  ON daily_totals(user_id, date);

CREATE INDEX IF NOT EXISTS idx_user_profiles_show_profile
  ON user_profiles(show_profile)
  WHERE show_profile = true;