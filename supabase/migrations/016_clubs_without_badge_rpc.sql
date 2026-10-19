-- Clubs with no badge, most-used first, for the Admin "Fill all missing" logo
-- view and scripts/backfill-club-logos.ts. usage_count is how many player_clubs
-- rows point at the club, so clubs that show up in games come before unused
-- youth/reserve teams. Unused clubs go last; ties break by name, then id so
-- pages stay stable. total_count is the number of badge-less clubs, repeated
-- on every row.
-- SECURITY INVOKER (default): relies on the existing public-SELECT RLS policies
-- on clubs and player_clubs, so nothing new is exposed.
CREATE OR REPLACE FUNCTION get_clubs_without_badge(p_offset INT DEFAULT 0, p_limit INT DEFAULT 20)
RETURNS TABLE (id TEXT, name TEXT, transfermarkt_id TEXT, usage_count INT, total_count INT)
LANGUAGE sql STABLE
AS $$
  SELECT c.id, c.name, c.transfermarkt_id,
         COALESCE(u.n, 0)::INT AS usage_count,
         (COUNT(*) OVER ())::INT AS total_count
  FROM clubs c
  LEFT JOIN (
    SELECT pc.club_id, COUNT(*) AS n
    FROM player_clubs pc
    JOIN clubs b ON b.id = pc.club_id AND b.badge = ''
    GROUP BY pc.club_id
  ) u ON u.club_id = c.id
  WHERE c.badge = ''
  ORDER BY COALESCE(u.n, 0) DESC, c.name, c.id
  OFFSET p_offset
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_clubs_without_badge(INT, INT) TO anon, authenticated;
