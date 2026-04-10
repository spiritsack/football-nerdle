-- Proper admin authentication via Supabase Auth
-- Replaces client-side passphrase + service role key with RLS-based authorization

-- 1. Admin users table (hardcoded email allowlist)
CREATE TABLE admin_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can read admin_users"
  ON admin_users FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM admin_users au WHERE au.email = auth.jwt()->>'email')
  );

-- Seed admin user
INSERT INTO admin_users (email) VALUES ('martinm@pm.me');

-- 2. Helper function to check if the current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE email = auth.jwt()->>'email'
  );
$$;

-- 3. Tighten RLS on data tables: keep SELECT for anyone, restrict writes to admins

-- clubs
DROP POLICY IF EXISTS "Anyone can insert clubs" ON clubs;
DROP POLICY IF EXISTS "Anyone can update clubs" ON clubs;
CREATE POLICY "Admins can insert clubs" ON clubs FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update clubs" ON clubs FOR UPDATE USING (is_admin());

-- players
DROP POLICY IF EXISTS "Anyone can insert players" ON players;
DROP POLICY IF EXISTS "Anyone can update players" ON players;
CREATE POLICY "Admins can insert players" ON players FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update players" ON players FOR UPDATE USING (is_admin());

-- player_clubs
DROP POLICY IF EXISTS "Anyone can insert player_clubs" ON player_clubs;
DROP POLICY IF EXISTS "Anyone can update player_clubs" ON player_clubs;
CREATE POLICY "Admins can insert player_clubs" ON player_clubs FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update player_clubs" ON player_clubs FOR UPDATE USING (is_admin());

-- countries
DROP POLICY IF EXISTS "Anyone can insert countries" ON countries;
DROP POLICY IF EXISTS "Anyone can update countries" ON countries;
CREATE POLICY "Admins can insert countries" ON countries FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update countries" ON countries FOR UPDATE USING (is_admin());

-- pool_refresh
DROP POLICY IF EXISTS "Anyone can insert pool_refresh" ON pool_refresh;
DROP POLICY IF EXISTS "Anyone can update pool_refresh" ON pool_refresh;
CREATE POLICY "Admins can insert pool_refresh" ON pool_refresh FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update pool_refresh" ON pool_refresh FOR UPDATE USING (is_admin());

-- 4. daily_schedule: keep anon SELECT + INSERT, restrict UPDATE + DELETE to admins
DROP POLICY IF EXISTS "Anyone can update daily_schedule" ON daily_schedule;
DROP POLICY IF EXISTS "Anyone can delete daily_schedule" ON daily_schedule;
CREATE POLICY "Admins can update daily_schedule"
  ON daily_schedule FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete daily_schedule"
  ON daily_schedule FOR DELETE USING (is_admin());

-- 5. Storage: restrict club-crests uploads to admins
DROP POLICY IF EXISTS "Anyone can upload club crests" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update club crests" ON storage.objects;
CREATE POLICY "Admins can upload club crests"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'club-crests' AND is_admin());
CREATE POLICY "Admins can update club crests"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'club-crests' AND is_admin());
