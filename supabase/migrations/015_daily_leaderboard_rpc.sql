-- Aggregate the daily leaderboard server-side so the client receives at most
-- one row per attempts value instead of every daily_results row.
-- SECURITY INVOKER (default): relies on the existing public-SELECT RLS policy
-- on daily_results, so nothing new is exposed.
CREATE OR REPLACE FUNCTION get_daily_leaderboard(p_date TEXT)
RETURNS TABLE (attempts INT, count INT)
LANGUAGE sql STABLE
AS $$
  SELECT r.attempts, COUNT(*)::INT AS count
  FROM daily_results r
  WHERE r.date = p_date
  GROUP BY r.attempts
  ORDER BY r.attempts;
$$;

GRANT EXECUTE ON FUNCTION get_daily_leaderboard(TEXT) TO anon, authenticated;
