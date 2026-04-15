-- Accent-insensitive search: normalized name column (ASCII only)
ALTER TABLE players ADD COLUMN IF NOT EXISTS name_search TEXT NOT NULL DEFAULT '';

-- Popularity score for search ranking (higher = more prominent)
-- Populated from TransferMarkt highest_market_value_in_eur
ALTER TABLE players ADD COLUMN IF NOT EXISTS popularity INT NOT NULL DEFAULT 0;
