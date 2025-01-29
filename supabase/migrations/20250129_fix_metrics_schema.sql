-- Fix daily_metric_scores table schema
BEGIN;

-- Create the table if it doesn't exist with all required columns
CREATE TABLE IF NOT EXISTS daily_metric_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    date DATE NOT NULL,
    metric_type TEXT NOT NULL,
    value NUMERIC NOT NULL DEFAULT 0,
    goal NUMERIC NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    goal_reached BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_metric_date UNIQUE (user_id, metric_type, date)
);

-- Add any missing columns to existing table
DO $$ 
BEGIN 
    -- Add value column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'daily_metric_scores' 
        AND column_name = 'value'
    ) THEN
        ALTER TABLE daily_metric_scores 
        ADD COLUMN value NUMERIC NOT NULL DEFAULT 0;
    END IF;

    -- Add goal column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'daily_metric_scores' 
        AND column_name = 'goal'
    ) THEN
        ALTER TABLE daily_metric_scores 
        ADD COLUMN goal NUMERIC NOT NULL DEFAULT 0;
    END IF;

    -- Add points column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'daily_metric_scores' 
        AND column_name = 'points'
    ) THEN
        ALTER TABLE daily_metric_scores 
        ADD COLUMN points INTEGER NOT NULL DEFAULT 0;
    END IF;

    -- Add goal_reached column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'daily_metric_scores' 
        AND column_name = 'goal_reached'
    ) THEN
        ALTER TABLE daily_metric_scores 
        ADD COLUMN goal_reached BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_metric_scores_user_date 
ON daily_metric_scores(user_id, date);

CREATE INDEX IF NOT EXISTS idx_daily_metric_scores_metric_type 
ON daily_metric_scores(metric_type);

-- Add constraints for data integrity
ALTER TABLE daily_metric_scores
DROP CONSTRAINT IF EXISTS chk_valid_points;

ALTER TABLE daily_metric_scores
ADD CONSTRAINT chk_valid_points 
CHECK (points >= 0 AND points <= 1000);

ALTER TABLE daily_metric_scores
DROP CONSTRAINT IF EXISTS chk_valid_value;

ALTER TABLE daily_metric_scores
ADD CONSTRAINT chk_valid_value 
CHECK (value >= 0);

ALTER TABLE daily_metric_scores
DROP CONSTRAINT IF EXISTS chk_valid_goal;

ALTER TABLE daily_metric_scores
ADD CONSTRAINT chk_valid_goal 
CHECK (goal >= 0);

-- Add trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_daily_metric_scores_updated_at 
ON daily_metric_scores;

CREATE TRIGGER update_daily_metric_scores_updated_at
    BEFORE UPDATE ON daily_metric_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update schema version
CREATE TABLE IF NOT EXISTS schema_versions (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_versions (version)
VALUES ('20250129_fix_metrics_schema')
ON CONFLICT DO NOTHING;

-- Refresh materialized views and update schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;