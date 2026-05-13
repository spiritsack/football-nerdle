-- Enable extensions for fuzzy name matching.
-- In this project both extensions live in the `public` schema; the wrapper
-- below schema-qualifies the function + dictionary so it resolves regardless
-- of the caller's search_path.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() is STABLE, so it can't be used directly in index expressions.
-- Wrap it in an IMMUTABLE SQL function so we can index/match on it.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- GIN trigram indexes for candidate search
CREATE INDEX IF NOT EXISTS idx_players_name_trgm
  ON players USING gin (immutable_unaccent(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clubs_name_trgm
  ON clubs USING gin (immutable_unaccent(name) gin_trgm_ops);

-- Dismissed duplicate pairs (admin-rejected, order-agnostic)
CREATE TABLE IF NOT EXISTS duplicate_dismissals (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('player', 'club')),
  id_a        TEXT NOT NULL,
  id_b        TEXT NOT NULL,
  reason      TEXT DEFAULT '',
  dismissed_by TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_dismissal UNIQUE (entity_type, id_a, id_b),
  CONSTRAINT ordered_ids CHECK (id_a < id_b)
);

-- Merge audit log (append-only)
CREATE TABLE IF NOT EXISTS merge_log (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type    TEXT NOT NULL CHECK (entity_type IN ('player', 'club')),
  winner_id      TEXT NOT NULL,
  loser_id       TEXT NOT NULL,
  loser_snapshot JSONB NOT NULL,
  rows_moved     JSONB DEFAULT '{}',
  merged_by      TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- RLS for new tables
ALTER TABLE duplicate_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read dismissals" ON duplicate_dismissals
  FOR SELECT USING (is_admin());
CREATE POLICY "Admin write dismissals" ON duplicate_dismissals
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin delete dismissals" ON duplicate_dismissals
  FOR DELETE USING (is_admin());

CREATE POLICY "Admin read merge_log" ON merge_log
  FOR SELECT USING (is_admin());
CREATE POLICY "Admin write merge_log" ON merge_log
  FOR INSERT WITH CHECK (is_admin());

--------------------------------------------------------------------
-- Find duplicate player candidates
--------------------------------------------------------------------
-- Drop first so return-column changes take effect (CREATE OR REPLACE
-- cannot alter a function's RETURNS TABLE signature).
DROP FUNCTION IF EXISTS find_duplicate_player_candidates(FLOAT, INT);

CREATE OR REPLACE FUNCTION find_duplicate_player_candidates(
  min_score FLOAT DEFAULT 0.55,
  max_results INT DEFAULT 50
)
RETURNS TABLE (
  id_a TEXT, id_b TEXT,
  name_a TEXT, name_b TEXT,
  dob_a TEXT, dob_b TEXT,
  nationality_a TEXT, nationality_b TEXT,
  thumbnail_a TEXT, thumbnail_b TEXT,
  position_a TEXT, position_b TEXT,
  source_a TEXT, source_b TEXT,
  transfermarkt_id_a TEXT, transfermarkt_id_b TEXT,
  stint_count_a BIGINT, stint_count_b BIGINT,
  score FLOAT,
  name_sim FLOAT,
  dob_match BOOLEAN,
  same_nationality BOOLEAN,
  cross_source BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
SET statement_timeout = '15s'
AS $$
  WITH pairs AS (
    SELECT
      LEAST(a.id, b.id) AS id_a,
      GREATEST(a.id, b.id) AS id_b,
      CASE WHEN a.id < b.id THEN a.name ELSE b.name END AS name_a,
      CASE WHEN a.id < b.id THEN b.name ELSE a.name END AS name_b,
      CASE WHEN a.id < b.id THEN COALESCE(a.date_born, '') ELSE COALESCE(b.date_born, '') END AS dob_a,
      CASE WHEN a.id < b.id THEN COALESCE(b.date_born, '') ELSE COALESCE(a.date_born, '') END AS dob_b,
      CASE WHEN a.id < b.id THEN COALESCE(ca.name, a.nationality_id, '') ELSE COALESCE(cb.name, b.nationality_id, '') END AS nationality_a,
      CASE WHEN a.id < b.id THEN COALESCE(cb.name, b.nationality_id, '') ELSE COALESCE(ca.name, a.nationality_id, '') END AS nationality_b,
      CASE WHEN a.id < b.id THEN COALESCE(a.thumbnail, '') ELSE COALESCE(b.thumbnail, '') END AS thumbnail_a,
      CASE WHEN a.id < b.id THEN COALESCE(b.thumbnail, '') ELSE COALESCE(a.thumbnail, '') END AS thumbnail_b,
      CASE WHEN a.id < b.id THEN COALESCE(a.position, '') ELSE COALESCE(b.position, '') END AS position_a,
      CASE WHEN a.id < b.id THEN COALESCE(b.position, '') ELSE COALESCE(a.position, '') END AS position_b,
      CASE WHEN a.id < b.id THEN COALESCE(a.data_source, '') ELSE COALESCE(b.data_source, '') END AS source_a,
      CASE WHEN a.id < b.id THEN COALESCE(b.data_source, '') ELSE COALESCE(a.data_source, '') END AS source_b,
      CASE WHEN a.id < b.id THEN a.transfermarkt_id ELSE b.transfermarkt_id END AS transfermarkt_id_a,
      CASE WHEN a.id < b.id THEN b.transfermarkt_id ELSE a.transfermarkt_id END AS transfermarkt_id_b,
      similarity(immutable_unaccent(a.name), immutable_unaccent(b.name)) AS name_sim,
      (COALESCE(a.date_born, '') <> '' AND a.date_born = b.date_born) AS dob_match,
      (a.nationality_id IS NOT NULL AND a.nationality_id = b.nationality_id) AS same_nationality,
      (COALESCE(a.data_source, '') <> COALESCE(b.data_source, '')) AS cross_source
    FROM players a
    JOIN players b ON a.id < b.id
      AND immutable_unaccent(a.name) % immutable_unaccent(b.name)
      -- Hard floor on name similarity so common first-name overlaps
      -- ("Juan García" / "Juan Pérez") don't flood the pair set.
      AND similarity(immutable_unaccent(a.name), immutable_unaccent(b.name)) >= 0.45
    LEFT JOIN countries ca ON ca.id = a.nationality_id
    LEFT JOIN countries cb ON cb.id = b.nationality_id
  )
  SELECT
    p.id_a, p.id_b,
    p.name_a, p.name_b,
    p.dob_a, p.dob_b,
    p.nationality_a, p.nationality_b,
    p.thumbnail_a, p.thumbnail_b,
    p.position_a, p.position_b,
    p.source_a, p.source_b,
    p.transfermarkt_id_a, p.transfermarkt_id_b,
    COALESCE(sa.cnt, 0) AS stint_count_a,
    COALESCE(sb.cnt, 0) AS stint_count_b,
    (p.name_sim
      + CASE WHEN p.dob_match THEN 0.30 ELSE 0 END
      + CASE WHEN p.same_nationality THEN 0.10 ELSE 0 END
      + CASE WHEN p.cross_source THEN 0.05 ELSE 0 END
    )::FLOAT AS score,
    p.name_sim::FLOAT,
    p.dob_match,
    p.same_nationality,
    p.cross_source
  FROM pairs p
  LEFT JOIN (SELECT player_id, COUNT(*) AS cnt FROM player_clubs GROUP BY player_id) sa ON sa.player_id = p.id_a
  LEFT JOIN (SELECT player_id, COUNT(*) AS cnt FROM player_clubs GROUP BY player_id) sb ON sb.player_id = p.id_b
  WHERE NOT EXISTS (
    SELECT 1 FROM duplicate_dismissals d
    WHERE d.entity_type = 'player' AND d.id_a = p.id_a AND d.id_b = p.id_b
  )
  AND (p.name_sim
    + CASE WHEN p.dob_match THEN 0.30 ELSE 0 END
    + CASE WHEN p.same_nationality THEN 0.10 ELSE 0 END
    + CASE WHEN p.cross_source THEN 0.05 ELSE 0 END
  ) >= min_score
  ORDER BY score DESC
  LIMIT max_results;
$$;

--------------------------------------------------------------------
-- Find duplicate club candidates
--------------------------------------------------------------------
DROP FUNCTION IF EXISTS find_duplicate_club_candidates(FLOAT, INT);

CREATE OR REPLACE FUNCTION find_duplicate_club_candidates(
  min_score FLOAT DEFAULT 0.55,
  max_results INT DEFAULT 50
)
RETURNS TABLE (
  id_a TEXT, id_b TEXT,
  name_a TEXT, name_b TEXT,
  country_a TEXT, country_b TEXT,
  badge_a TEXT, badge_b TEXT,
  player_count_a BIGINT, player_count_b BIGINT,
  score FLOAT,
  name_sim FLOAT,
  same_country BOOLEAN,
  roster_overlap FLOAT,
  shared_player_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET statement_timeout = '15s'
AS $$
  WITH pairs AS (
    SELECT
      LEAST(a.id, b.id) AS id_a,
      GREATEST(a.id, b.id) AS id_b,
      CASE WHEN a.id < b.id THEN a.name ELSE b.name END AS name_a,
      CASE WHEN a.id < b.id THEN b.name ELSE a.name END AS name_b,
      CASE WHEN a.id < b.id THEN COALESCE(ca.name, a.country_id, '') ELSE COALESCE(cb.name, b.country_id, '') END AS country_a,
      CASE WHEN a.id < b.id THEN COALESCE(cb.name, b.country_id, '') ELSE COALESCE(ca.name, a.country_id, '') END AS country_b,
      CASE WHEN a.id < b.id THEN COALESCE(a.badge, '') ELSE COALESCE(b.badge, '') END AS badge_a,
      CASE WHEN a.id < b.id THEN COALESCE(b.badge, '') ELSE COALESCE(a.badge, '') END AS badge_b,
      similarity(immutable_unaccent(a.name), immutable_unaccent(b.name)) AS name_sim,
      (a.country_id IS NOT NULL AND a.country_id = b.country_id) AS same_country
    FROM clubs a
    JOIN clubs b ON a.id < b.id
      AND immutable_unaccent(a.name) % immutable_unaccent(b.name)
      AND similarity(immutable_unaccent(a.name), immutable_unaccent(b.name)) >= 0.45
    LEFT JOIN countries ca ON ca.id = a.country_id
    LEFT JOIN countries cb ON cb.id = b.country_id
  ),
  roster_counts AS (
    SELECT club_id, COUNT(DISTINCT player_id) AS cnt
    FROM player_clubs
    GROUP BY club_id
  ),
  shared AS (
    SELECT
      LEAST(pc1.club_id, pc2.club_id) AS id_a,
      GREATEST(pc1.club_id, pc2.club_id) AS id_b,
      COUNT(DISTINCT pc1.player_id) AS shared_count
    FROM player_clubs pc1
    JOIN player_clubs pc2 ON pc1.player_id = pc2.player_id AND pc1.club_id < pc2.club_id
    GROUP BY LEAST(pc1.club_id, pc2.club_id), GREATEST(pc1.club_id, pc2.club_id)
  )
  SELECT
    p.id_a, p.id_b,
    p.name_a, p.name_b,
    p.country_a, p.country_b,
    p.badge_a, p.badge_b,
    COALESCE(ra.cnt, 0) AS player_count_a,
    COALESCE(rb.cnt, 0) AS player_count_b,
    (p.name_sim
      + CASE WHEN p.same_country THEN 0.15 ELSE 0 END
      + LEAST(0.40, 0.40 * COALESCE(s.shared_count, 0)::FLOAT / GREATEST(1, LEAST(COALESCE(ra.cnt, 0), COALESCE(rb.cnt, 0))))
    )::FLOAT AS score,
    p.name_sim::FLOAT,
    p.same_country,
    (COALESCE(s.shared_count, 0)::FLOAT / GREATEST(1, LEAST(COALESCE(ra.cnt, 0), COALESCE(rb.cnt, 0))))::FLOAT AS roster_overlap,
    COALESCE(s.shared_count, 0) AS shared_player_count
  FROM pairs p
  LEFT JOIN roster_counts ra ON ra.club_id = p.id_a
  LEFT JOIN roster_counts rb ON rb.club_id = p.id_b
  LEFT JOIN shared s ON s.id_a = p.id_a AND s.id_b = p.id_b
  WHERE NOT EXISTS (
    SELECT 1 FROM duplicate_dismissals d
    WHERE d.entity_type = 'club' AND d.id_a = p.id_a AND d.id_b = p.id_b
  )
  AND (p.name_sim
    + CASE WHEN p.same_country THEN 0.15 ELSE 0 END
    + LEAST(0.40, 0.40 * COALESCE(s.shared_count, 0)::FLOAT / GREATEST(1, LEAST(COALESCE(ra.cnt, 0), COALESCE(rb.cnt, 0))))
  ) >= min_score
  ORDER BY score DESC
  LIMIT max_results;
$$;

--------------------------------------------------------------------
-- Dismiss a duplicate pair
--------------------------------------------------------------------
DROP FUNCTION IF EXISTS dismiss_duplicate(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION dismiss_duplicate(
  p_entity_type TEXT,
  p_id_a TEXT,
  p_id_b TEXT,
  p_reason TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO duplicate_dismissals (entity_type, id_a, id_b, reason, dismissed_by)
  VALUES (
    p_entity_type,
    LEAST(p_id_a, p_id_b),
    GREATEST(p_id_a, p_id_b),
    p_reason,
    auth.jwt()->>'email'
  )
  ON CONFLICT (entity_type, id_a, id_b) DO NOTHING;
END;
$$;

--------------------------------------------------------------------
-- Merge two players (winner absorbs loser)
--------------------------------------------------------------------
DROP FUNCTION IF EXISTS merge_players(TEXT, TEXT);

CREATE OR REPLACE FUNCTION merge_players(
  p_winner_id TEXT,
  p_loser_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_loser_snapshot JSONB;
  v_stints_moved INT := 0;
  v_stints_dropped INT := 0;
  v_schedule_moved INT := 0;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_winner_id = p_loser_id THEN
    RAISE EXCEPTION 'winner and loser must be different';
  END IF;

  -- Lock both rows
  PERFORM id FROM players WHERE id IN (p_winner_id, p_loser_id) FOR UPDATE;

  -- Check both exist
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_winner_id) THEN
    RAISE EXCEPTION 'winner not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_loser_id) THEN
    RAISE EXCEPTION 'loser not found';
  END IF;

  -- Refuse if both appear in same pack
  IF EXISTS (
    SELECT 1 FROM pack_schedule
    WHERE p_winner_id = ANY(player_ids) AND p_loser_id = ANY(player_ids)
  ) THEN
    RAISE EXCEPTION 'both players appear in the same pack';
  END IF;

  -- Snapshot loser
  SELECT jsonb_build_object(
    'player', row_to_json(p),
    'stints', COALESCE((
      SELECT jsonb_agg(row_to_json(pc))
      FROM player_clubs pc WHERE pc.player_id = p_loser_id
    ), '[]'::jsonb)
  ) INTO v_loser_snapshot
  FROM players p WHERE p.id = p_loser_id;

  -- Drop loser stints that would collide on (player_id, club_id, year_joined)
  DELETE FROM player_clubs
  WHERE player_id = p_loser_id
    AND (club_id, year_joined) IN (
      SELECT club_id, year_joined FROM player_clubs WHERE player_id = p_winner_id
    );
  GET DIAGNOSTICS v_stints_dropped = ROW_COUNT;

  -- Reparent remaining loser stints
  UPDATE player_clubs SET player_id = p_winner_id WHERE player_id = p_loser_id;
  GET DIAGNOSTICS v_stints_moved = ROW_COUNT;

  -- Reparent daily_schedule
  UPDATE daily_schedule SET player_id = p_winner_id WHERE player_id = p_loser_id;
  GET DIAGNOSTICS v_schedule_moved = ROW_COUNT;

  -- Replace in pack_schedule arrays
  UPDATE pack_schedule
  SET player_ids = array_replace(player_ids, p_loser_id, p_winner_id)
  WHERE p_loser_id = ANY(player_ids);

  -- Backfill empty winner fields from loser
  UPDATE players w SET
    thumbnail = COALESCE(NULLIF(w.thumbnail, ''), l.thumbnail),
    date_born = COALESCE(NULLIF(w.date_born, ''), l.date_born),
    position = COALESCE(NULLIF(w.position, ''), l.position),
    transfermarkt_id = CASE
      WHEN w.transfermarkt_id IS NULL THEN l.transfermarkt_id
      ELSE w.transfermarkt_id
    END
  FROM players l
  WHERE w.id = p_winner_id AND l.id = p_loser_id;

  -- Delete loser
  DELETE FROM players WHERE id = p_loser_id;

  -- Audit log
  INSERT INTO merge_log (entity_type, winner_id, loser_id, loser_snapshot, rows_moved, merged_by)
  VALUES (
    'player', p_winner_id, p_loser_id, v_loser_snapshot,
    jsonb_build_object('stints_moved', v_stints_moved, 'stints_dropped', v_stints_dropped, 'schedule_moved', v_schedule_moved),
    auth.jwt()->>'email'
  );

  RETURN jsonb_build_object(
    'stints_moved', v_stints_moved,
    'stints_dropped', v_stints_dropped,
    'schedule_moved', v_schedule_moved
  );
END;
$$;

--------------------------------------------------------------------
-- Merge two clubs (winner absorbs loser)
--------------------------------------------------------------------
DROP FUNCTION IF EXISTS merge_clubs(TEXT, TEXT);

CREATE OR REPLACE FUNCTION merge_clubs(
  p_winner_id TEXT,
  p_loser_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_loser_snapshot JSONB;
  v_stints_moved INT := 0;
  v_stints_dropped INT := 0;
  v_players_updated INT := 0;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_winner_id = p_loser_id THEN
    RAISE EXCEPTION 'winner and loser must be different';
  END IF;

  -- Lock both rows
  PERFORM id FROM clubs WHERE id IN (p_winner_id, p_loser_id) FOR UPDATE;

  IF NOT EXISTS (SELECT 1 FROM clubs WHERE id = p_winner_id) THEN
    RAISE EXCEPTION 'winner not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM clubs WHERE id = p_loser_id) THEN
    RAISE EXCEPTION 'loser not found';
  END IF;

  -- Snapshot loser
  SELECT jsonb_build_object(
    'club', row_to_json(c),
    'stint_count', (SELECT COUNT(*) FROM player_clubs WHERE club_id = p_loser_id)
  ) INTO v_loser_snapshot
  FROM clubs c WHERE c.id = p_loser_id;

  -- Drop loser stints that would collide on (player_id, club_id, year_joined)
  DELETE FROM player_clubs
  WHERE club_id = p_loser_id
    AND (player_id, year_joined) IN (
      SELECT player_id, year_joined FROM player_clubs WHERE club_id = p_winner_id
    );
  GET DIAGNOSTICS v_stints_dropped = ROW_COUNT;

  -- Reparent remaining loser stints
  UPDATE player_clubs SET club_id = p_winner_id WHERE club_id = p_loser_id;
  GET DIAGNOSTICS v_stints_moved = ROW_COUNT;

  -- Update players.current_club_id
  UPDATE players SET current_club_id = p_winner_id WHERE current_club_id = p_loser_id;
  GET DIAGNOSTICS v_players_updated = ROW_COUNT;

  -- Replace in pack_schedule
  UPDATE pack_schedule SET club_id = p_winner_id WHERE club_id = p_loser_id;

  -- Backfill empty winner fields
  UPDATE clubs w SET
    badge = COALESCE(NULLIF(w.badge, ''), l.badge),
    league = COALESCE(NULLIF(w.league, ''), l.league),
    country_id = COALESCE(w.country_id, l.country_id)
  FROM clubs l
  WHERE w.id = p_winner_id AND l.id = p_loser_id;

  -- Delete loser
  DELETE FROM clubs WHERE id = p_loser_id;

  -- Audit log
  INSERT INTO merge_log (entity_type, winner_id, loser_id, loser_snapshot, rows_moved, merged_by)
  VALUES (
    'club', p_winner_id, p_loser_id, v_loser_snapshot,
    jsonb_build_object('stints_moved', v_stints_moved, 'stints_dropped', v_stints_dropped, 'players_updated', v_players_updated),
    auth.jwt()->>'email'
  );

  RETURN jsonb_build_object(
    'stints_moved', v_stints_moved,
    'stints_dropped', v_stints_dropped,
    'players_updated', v_players_updated
  );
END;
$$;
