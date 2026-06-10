-- Storage bucket for admin-uploaded player thumbnails, mirroring club-crests
-- (public read, admin-only writes; see 006_admin_features.sql + 008_admin_auth.sql).

INSERT INTO storage.buckets (id, name, public)
VALUES ('player-thumbnails', 'player-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for player thumbnails"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'player-thumbnails');

CREATE POLICY "Admins can upload player thumbnails"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'player-thumbnails' AND is_admin());

CREATE POLICY "Admins can update player thumbnails"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'player-thumbnails' AND is_admin());
