-- Allow a loan spell and a permanent spell at the same club starting the same
-- year (e.g. loan in January, signed permanently in July). The original
-- UNIQUE (player_id, club_id, year_joined) rejected the second row.
-- Import/backfill scripts upsert with the matching conflict target
-- "player_id,club_id,year_joined,is_loan" (their rows default is_loan = false,
-- so script dedup behaviour is unchanged).

ALTER TABLE player_clubs
  DROP CONSTRAINT IF EXISTS player_clubs_player_id_club_id_year_joined_key;

ALTER TABLE player_clubs
  ADD CONSTRAINT player_clubs_player_club_year_loan_key
  UNIQUE (player_id, club_id, year_joined, is_loan);
