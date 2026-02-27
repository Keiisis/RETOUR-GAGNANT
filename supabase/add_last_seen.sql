-- Migration: Add last_seen_at column for real-time presence tracking
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;
-- Allow agents/admins to update their own last_seen_at
CREATE POLICY IF NOT EXISTS "Users can update own last_seen" ON user_profiles FOR
UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);