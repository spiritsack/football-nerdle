--------------------------------------------------------------------
-- Find clubs that both players have stints at (shared club history)
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_shared_clubs_for_players(
  p_player_a TEXT,
  p_player_b TEXT
)
RETURNS TABLE (
  club_id TEXT,
  club_name TEXT,
  club_badge TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT c.id, c.name, COALESCE(c.badge, '')
  FROM player_clubs pc
  JOIN clubs c ON c.id = pc.club_id
  WHERE pc.player_id IN (p_player_a, p_player_b)
  GROUP BY c.id, c.name, c.badge
  HAVING COUNT(DISTINCT pc.player_id) = 2
  ORDER BY c.name;
$$;

--------------------------------------------------------------------
-- Find players that have stints at both clubs (roster overlap preview)
-- Returns year ranges at each club for admin sanity-checking
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_shared_players_for_clubs(
  p_club_a TEXT,
  p_club_b TEXT
)
RETURNS TABLE (
  player_id TEXT,
  player_name TEXT,
  years_at_a TEXT,
  years_at_b TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.name,
    (SELECT string_agg(
      COALESCE(NULLIF(pc1.year_joined, ''), '?') || '–' || COALESCE(NULLIF(pc1.year_departed, ''), 'present'),
      ', ' ORDER BY pc1.year_joined
    ) FROM player_clubs pc1 WHERE pc1.player_id = p.id AND pc1.club_id = p_club_a),
    (SELECT string_agg(
      COALESCE(NULLIF(pc2.year_joined, ''), '?') || '–' || COALESCE(NULLIF(pc2.year_departed, ''), 'present'),
      ', ' ORDER BY pc2.year_joined
    ) FROM player_clubs pc2 WHERE pc2.player_id = p.id AND pc2.club_id = p_club_b)
  FROM player_clubs pc
  JOIN players p ON p.id = pc.player_id
  WHERE pc.club_id IN (p_club_a, p_club_b)
  GROUP BY p.id, p.name
  HAVING COUNT(DISTINCT pc.club_id) = 2
  ORDER BY p.name;
$$;
