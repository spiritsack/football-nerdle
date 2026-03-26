-- Add TransferMarkt ID columns (additive — no drops, no renames)
ALTER TABLE players ADD COLUMN IF NOT EXISTS transfermarkt_id TEXT UNIQUE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'sportsdb';

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS transfermarkt_id TEXT UNIQUE;
