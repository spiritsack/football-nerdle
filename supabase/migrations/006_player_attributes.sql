-- Add new player attributes from TransferMarkt dataset
ALTER TABLE players ADD COLUMN IF NOT EXISTS foot TEXT NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS height_in_cm INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS date_of_birth TEXT NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS international_caps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS international_goals INTEGER NOT NULL DEFAULT 0;

-- Add ISO country code for flag images
ALTER TABLE countries ADD COLUMN IF NOT EXISTS iso_code TEXT;
