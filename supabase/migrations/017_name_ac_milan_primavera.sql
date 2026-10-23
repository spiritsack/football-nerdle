-- Name tm_10958 "AC Milan Primavera" and move Tomori's permanent row to tm_5.
--
-- Data-only: no schema or RLS change. Safe to run more than once; a second run
-- changes nothing and only raises notices.
--
-- Evidence (checked when merging the duplicate AC Milan clubs was considered and
-- rejected): TransferMarkt verein/10958 is "AC Milan Primavera", Milan's youth
-- side, but the import stored it under the first-team name "AC Milan". Players
-- join it aged 15-19; Fikayo Tomori (tm_303254) is the lone senior signing
-- there, so his 2021 permanent move belongs to the first team (tm_5).
--
-- Known limit: the clubs upsert in scripts/import-transfermarkt.ts ignores
-- duplicates, so a re-import keeps the new name, but it would recreate
-- Tomori's tm_10958 row.

DO $$
DECLARE
  n INT;
BEGIN
  -- 1. Rename the youth club. 0 rows: already renamed, or the club is missing.
  UPDATE clubs
  SET name = 'AC Milan Primavera'
  WHERE id = 'tm_10958' AND name = 'AC Milan';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'tm_10958 renamed to AC Milan Primavera: % row(s)', n;

  -- 2. Repoint Tomori's 2021 permanent row to the first team, unless tm_5
  -- already has a row with the same (player_id, year_joined, is_loan), which
  -- the unique key from 013_loan_in_unique_constraint.sql would reject. His
  -- existing tm_5 row is the 2021 loan (is_loan = true), so it does not clash.
  UPDATE player_clubs pc
  SET club_id = 'tm_5'
  WHERE pc.player_id = 'tm_303254'
    AND pc.club_id = 'tm_10958'
    AND pc.year_joined = '2021'
    AND pc.is_loan = false
    AND NOT EXISTS (
      SELECT 1 FROM player_clubs t
      WHERE t.player_id = pc.player_id
        AND t.club_id = 'tm_5'
        AND t.year_joined = pc.year_joined
        AND t.is_loan = pc.is_loan
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Tomori 2021 permanent row moved from tm_10958 to tm_5: % row(s)', n;
END
$$;
