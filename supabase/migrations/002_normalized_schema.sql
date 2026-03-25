-- Drop old cache tables (no production users yet)
DROP TABLE IF EXISTS player_teams CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- Countries
CREATE TABLE countries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read countries" ON countries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert countries" ON countries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update countries" ON countries FOR UPDATE USING (true);

-- Clubs
CREATE TABLE clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  badge TEXT NOT NULL DEFAULT '',
  league_id TEXT,
  country_id TEXT REFERENCES countries(id),
  is_top_club BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read clubs" ON clubs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert clubs" ON clubs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update clubs" ON clubs FOR UPDATE USING (true);

-- Players (extended)
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  thumbnail TEXT NOT NULL DEFAULT '',
  nationality_id TEXT REFERENCES countries(id),
  position TEXT NOT NULL DEFAULT '',
  date_born TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  current_club_id TEXT REFERENCES clubs(id),
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read players" ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can insert players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update players" ON players FOR UPDATE USING (true);

-- Player club history (replaces player_teams)
CREATE TABLE player_clubs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  club_id TEXT NOT NULL REFERENCES clubs(id),
  year_joined TEXT NOT NULL DEFAULT '',
  year_departed TEXT NOT NULL DEFAULT '',
  UNIQUE (player_id, club_id, year_joined)
);

CREATE INDEX idx_player_clubs_player_id ON player_clubs(player_id);
CREATE INDEX idx_player_clubs_club_id ON player_clubs(club_id);

ALTER TABLE player_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read player_clubs" ON player_clubs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert player_clubs" ON player_clubs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update player_clubs" ON player_clubs FOR UPDATE USING (true);

-- Pool refresh tracking
CREATE TABLE pool_refresh (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  last_refresh DATE NOT NULL,
  clubs_refreshed JSONB NOT NULL DEFAULT '[]'
);

ALTER TABLE pool_refresh ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read pool_refresh" ON pool_refresh FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pool_refresh" ON pool_refresh FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update pool_refresh" ON pool_refresh FOR UPDATE USING (true);
