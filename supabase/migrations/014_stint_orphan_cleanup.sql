--------------------------------------------------------------------
-- Find fragmented stints: (player, club) pairs with ≥2 overlapping
-- or adjacent rows (year ranges within 1 year of each other)
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_fragmented_stints(
  max_results INT DEFAULT 100
)
RETURNS TABLE (
  player_id TEXT,
  player_name TEXT,
  club_id TEXT,
  club_name TEXT,
  stint_count BIGINT,
  earliest_joined TEXT,
  latest_departed TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    pc.player_id,
    p.name AS player_name,
    pc.club_id,
    c.name AS club_name,
    COUNT(*) AS stint_count,
    MIN(NULLIF(pc.year_joined, '')) AS earliest_joined,
    CASE
      WHEN BOOL_OR(COALESCE(pc.year_departed, '') = '') THEN ''
      ELSE MAX(pc.year_departed)
    END AS latest_departed
  FROM player_clubs pc
  JOIN players p ON p.id = pc.player_id
  JOIN clubs c ON c.id = pc.club_id
  GROUP BY pc.player_id, p.name, pc.club_id, c.name
  HAVING COUNT(*) >= 2
  ORDER BY COUNT(*) DESC, p.name
  LIMIT max_results;
$$;

--------------------------------------------------------------------
-- Merge stints for a (player, club) pair into a single row:
-- keeps earliest year_joined and latest year_departed, deletes extras
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION merge_stints(
  p_player_id TEXT,
  p_club_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_earliest TEXT;
  v_latest TEXT;
  v_has_ongoing BOOLEAN;
  v_keep_id BIGINT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM player_clubs
  WHERE player_id = p_player_id AND club_id = p_club_id;

  IF v_count < 2 THEN
    RAISE EXCEPTION 'nothing to merge — fewer than 2 stints';
  END IF;

  -- Compute the merged range
  SELECT
    MIN(NULLIF(year_joined, '')),
    MAX(year_departed),
    BOOL_OR(COALESCE(year_departed, '') = '')
  INTO v_earliest, v_latest, v_has_ongoing
  FROM player_clubs
  WHERE player_id = p_player_id AND club_id = p_club_id;

  IF v_has_ongoing THEN
    v_latest := '';
  END IF;

  -- Pick one row to keep (lowest id)
  SELECT id INTO v_keep_id
  FROM player_clubs
  WHERE player_id = p_player_id AND club_id = p_club_id
  ORDER BY id
  LIMIT 1;

  -- Delete all other rows
  DELETE FROM player_clubs
  WHERE player_id = p_player_id AND club_id = p_club_id AND id <> v_keep_id;

  -- Update the kept row with merged range
  UPDATE player_clubs
  SET year_joined = COALESCE(v_earliest, ''),
      year_departed = COALESCE(v_latest, '')
  WHERE id = v_keep_id;

  RETURN jsonb_build_object(
    'stints_merged', v_count,
    'kept_joined', COALESCE(v_earliest, ''),
    'kept_departed', COALESCE(v_latest, '')
  );
END;
$$;

--------------------------------------------------------------------
-- Find orphan players (0 club stints, not in any schedule)
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_orphan_players(
  max_results INT DEFAULT 100
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  date_born TEXT,
  nationality TEXT,
  data_source TEXT,
  thumbnail TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.name,
    COALESCE(p.date_born, '') AS date_born,
    COALESCE(c.name, p.nationality_id, '') AS nationality,
    COALESCE(p.data_source, '') AS data_source,
    COALESCE(p.thumbnail, '') AS thumbnail
  FROM players p
  LEFT JOIN countries c ON c.id = p.nationality_id
  WHERE NOT EXISTS (
    SELECT 1 FROM player_clubs pc WHERE pc.player_id = p.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM daily_schedule ds WHERE ds.player_id = p.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM pack_schedule ps WHERE p.id = ANY(ps.player_ids)
  )
  ORDER BY p.name
  LIMIT max_results;
$$;

--------------------------------------------------------------------
-- Find orphan clubs (0 player stints, not referenced elsewhere)
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_orphan_clubs(
  max_results INT DEFAULT 100
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  country TEXT,
  badge TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    cl.id,
    cl.name,
    COALESCE(co.name, cl.country_id, '') AS country,
    COALESCE(cl.badge, '') AS badge
  FROM clubs cl
  LEFT JOIN countries co ON co.id = cl.country_id
  WHERE NOT EXISTS (
    SELECT 1 FROM player_clubs pc WHERE pc.club_id = cl.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM players p WHERE p.current_club_id = cl.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM pack_schedule ps WHERE ps.club_id = cl.id
  )
  ORDER BY cl.name
  LIMIT max_results;
$$;

--------------------------------------------------------------------
-- Delete an orphan player (only if truly orphaned)
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_orphan_player(p_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF EXISTS (SELECT 1 FROM player_clubs WHERE player_id = p_id) THEN
    RAISE EXCEPTION 'player still has stints — not an orphan';
  END IF;

  IF EXISTS (SELECT 1 FROM daily_schedule WHERE player_id = p_id) THEN
    RAISE EXCEPTION 'player is in daily schedule — not safe to delete';
  END IF;

  IF EXISTS (SELECT 1 FROM pack_schedule WHERE p_id = ANY(player_ids)) THEN
    RAISE EXCEPTION 'player is in a pack — not safe to delete';
  END IF;

  DELETE FROM players WHERE id = p_id;
END;
$$;

--------------------------------------------------------------------
-- Delete an orphan club (only if truly orphaned)
--------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_orphan_club(p_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF EXISTS (SELECT 1 FROM player_clubs WHERE club_id = p_id) THEN
    RAISE EXCEPTION 'club still has stints — not an orphan';
  END IF;

  IF EXISTS (SELECT 1 FROM players WHERE current_club_id = p_id) THEN
    RAISE EXCEPTION 'club is a current club for a player — not safe to delete';
  END IF;

  IF EXISTS (SELECT 1 FROM pack_schedule WHERE club_id = p_id) THEN
    RAISE EXCEPTION 'club is in a pack — not safe to delete';
  END IF;

  DELETE FROM clubs WHERE id = p_id;
END;
$$;
