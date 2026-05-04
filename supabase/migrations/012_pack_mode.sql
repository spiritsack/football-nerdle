-- Pack mode: 10 players from one club per day
-- Mirrors daily_schedule (admin-curated) and daily_results (anon-insert) RLS shape

CREATE TABLE pack_schedule (
  date TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_ids TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pack_schedule_ten_players CHECK (array_length(player_ids, 1) = 10)
);

ALTER TABLE pack_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read pack_schedule" ON pack_schedule FOR SELECT USING (true);
CREATE POLICY "Admins can insert pack_schedule" ON pack_schedule FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update pack_schedule" ON pack_schedule FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete pack_schedule" ON pack_schedule FOR DELETE USING (is_admin());

CREATE TABLE pack_results (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date TEXT NOT NULL,
  score INT NOT NULL CHECK (score >= 0 AND score <= 10),
  attempts_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pack_results_date ON pack_results(date);

ALTER TABLE pack_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read pack_results" ON pack_results FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pack_results" ON pack_results FOR INSERT WITH CHECK (true);

-- Seed today's pack: pick any club that has at least 10 visible non-youth players,
-- prefer top clubs. Skips silently if no qualifying club exists yet.
DO $$
DECLARE
  picked_club_id TEXT;
  picked_player_ids TEXT[];
BEGIN
  SELECT pc.club_id, ARRAY(
    SELECT pc2.player_id
    FROM player_clubs pc2
    WHERE pc2.club_id = pc.club_id
      AND COALESCE(pc2.is_hidden, false) = false
      AND COALESCE(pc2.is_youth_team, false) = false
    LIMIT 10
  )
  INTO picked_club_id, picked_player_ids
  FROM player_clubs pc
  JOIN clubs c ON c.id = pc.club_id
  WHERE COALESCE(pc.is_hidden, false) = false
    AND COALESCE(pc.is_youth_team, false) = false
  GROUP BY pc.club_id, c.is_top_club
  HAVING COUNT(DISTINCT pc.player_id) >= 10
  ORDER BY c.is_top_club DESC NULLS LAST, RANDOM()
  LIMIT 1;

  IF picked_club_id IS NOT NULL AND array_length(picked_player_ids, 1) = 10 THEN
    INSERT INTO pack_schedule (date, club_id, player_ids)
    VALUES (CURRENT_DATE::TEXT, picked_club_id, picked_player_ids)
    ON CONFLICT (date) DO NOTHING;
  END IF;
END $$;
