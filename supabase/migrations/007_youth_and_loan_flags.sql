-- Add youth team and loan flags to player_clubs for admin curation
ALTER TABLE player_clubs
  ADD COLUMN IF NOT EXISTS is_youth_team BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE player_clubs
  ADD COLUMN IF NOT EXISTS is_loan BOOLEAN NOT NULL DEFAULT false;
