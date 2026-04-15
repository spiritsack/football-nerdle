-- Enable unaccent extension for diacritics-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Search function: accent-insensitive, returns players ordered by relevance
CREATE OR REPLACE FUNCTION search_players(query TEXT)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  thumbnail TEXT,
  nationality TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.thumbnail,
    COALESCE(c.name, p.nationality_id, '') AS nationality
  FROM players p
  LEFT JOIN countries c ON c.id = p.nationality_id
  WHERE unaccent(p.name) ILIKE '%' || unaccent(query) || '%'
  ORDER BY
    -- Exact start-of-name matches first
    CASE WHEN unaccent(p.name) ILIKE unaccent(query) || '%' THEN 0 ELSE 1 END,
    -- Shorter names first (more likely to be the intended match)
    length(p.name)
  LIMIT 10;
$$;
