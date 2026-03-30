-- Tracks which player is shown each day for Guess the Player daily mode.
-- First user of the day inserts the record; subsequent users read it.
-- ON CONFLICT ensures only one player per day (first writer wins).

CREATE TABLE daily_schedule (
  date TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE daily_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read daily_schedule" ON daily_schedule FOR SELECT USING (true);
CREATE POLICY "Anyone can insert daily_schedule" ON daily_schedule FOR INSERT WITH CHECK (true);
-- No UPDATE or DELETE — records are immutable once created
