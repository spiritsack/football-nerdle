-- Lock down data tables to read-only for the anon key.
-- Only the import script (using service role key) can write.
-- game_rooms remains writable for multiplayer.

DROP POLICY IF EXISTS "Anyone can insert countries" ON countries;
DROP POLICY IF EXISTS "Anyone can update countries" ON countries;
DROP POLICY IF EXISTS "Anyone can insert clubs" ON clubs;
DROP POLICY IF EXISTS "Anyone can update clubs" ON clubs;
DROP POLICY IF EXISTS "Anyone can insert players" ON players;
DROP POLICY IF EXISTS "Anyone can update players" ON players;
DROP POLICY IF EXISTS "Anyone can insert player_clubs" ON player_clubs;
DROP POLICY IF EXISTS "Anyone can update player_clubs" ON player_clubs;
DROP POLICY IF EXISTS "Anyone can insert pool_refresh" ON pool_refresh;
DROP POLICY IF EXISTS "Anyone can update pool_refresh" ON pool_refresh;
