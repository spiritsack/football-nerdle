-- Admin features: schedule editing + club visibility control + crest storage

-- 1. Allow modifying daily_schedule entries (for curating upcoming puzzles)
CREATE POLICY "Anyone can update daily_schedule"
  ON daily_schedule FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete daily_schedule"
  ON daily_schedule FOR DELETE USING (true);

-- 2. Add hidden flag and sort order to player_clubs
ALTER TABLE player_clubs
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE player_clubs
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- 3. Create storage bucket for uploaded club crests
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-crests', 'club-crests', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to club crests
CREATE POLICY "Public read access for club crests"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'club-crests');

-- Allow anyone to upload club crests (admin passphrase is enforced client-side)
CREATE POLICY "Anyone can upload club crests"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'club-crests');

-- Allow anyone to overwrite club crests
CREATE POLICY "Anyone can update club crests"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'club-crests');
