-- Add optional legacy override to players table
-- NULL = auto-detect from club history (default)
-- TRUE = force legacy display
-- FALSE = force non-legacy display
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN DEFAULT NULL;
