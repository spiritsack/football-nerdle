-- Players cache: stores TheSportsDB player identity data
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  thumbnail TEXT NOT NULL DEFAULT '',
  nationality TEXT NOT NULL DEFAULT '',
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Player teams cache: stores merged former-teams list per player
CREATE TABLE player_teams (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  year_joined TEXT NOT NULL DEFAULT '',
  year_departed TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT '',
  UNIQUE (player_id, team_id, year_joined)
);

CREATE INDEX idx_player_teams_player_id ON player_teams(player_id);

-- Multiplayer game rooms
CREATE TABLE game_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  host_id TEXT NOT NULL,
  guest_id TEXT,
  current_turn TEXT,
  chain JSONB NOT NULL DEFAULT '[]',
  used_player_ids JSONB NOT NULL DEFAULT '[]',
  last_shared_clubs JSONB NOT NULL DEFAULT '[]',
  turn_started_at TIMESTAMPTZ,
  host_last_seen TIMESTAMPTZ,
  guest_last_seen TIMESTAMPTZ,
  winner TEXT,
  lose_reason TEXT,
  score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_rooms_code ON game_rooms(code);

-- RLS policies

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read players" ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can insert players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update players" ON players FOR UPDATE USING (true);

ALTER TABLE player_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read player_teams" ON player_teams FOR SELECT USING (true);
CREATE POLICY "Anyone can insert player_teams" ON player_teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update player_teams" ON player_teams FOR UPDATE USING (true);

ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read rooms" ON game_rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can create rooms" ON game_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rooms" ON game_rooms FOR UPDATE USING (true);

-- Enable realtime for game_rooms
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;
