-- Daily result submissions for community leaderboard
-- Attempts: 1-5 = won in that many tries, 0 = failed
CREATE TABLE daily_results (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date TEXT NOT NULL,
  attempts INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_results_date ON daily_results(date);

ALTER TABLE daily_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read daily_results" ON daily_results FOR SELECT USING (true);
CREATE POLICY "Anyone can insert daily_results" ON daily_results FOR INSERT WITH CHECK (true);
