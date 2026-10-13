-- Merge duplicate Wikidata (wd_*) clubs into their canonical TransferMarkt twins.
--
-- Why: the Wikidata backfill created wd_* club rows that duplicate clubs we
-- already have from TransferMarkt (e.g. "FC Bayern Munich" vs tm_27
-- "Bayern Munich"). didPlayTogether matches on club_id, so Battle mode missed
-- real teammates (Robben tm_4360 / Kimmich tm_161056 at Bayern), and
-- backfilled careers showed no crests.
--
-- DATA-ONLY migration: no schema or RLS change. Apply manually to staging,
-- then prod (SQL Editor or `supabase db push`).
--
-- Canonical ids were verified read-only against production on 2026-06-10.
-- Left unmerged (no TransferMarkt twin): Asturias autonomous football team,
-- FC Metalurh Donetsk, Qingdao F.C., Hebei F.C., VV Bedum, Marsala FC,
-- Arenys de Mar, UFB Jàbac i Terrassa, FK Spartak Subotica, Sporting de Gijón B.
--
-- Idempotent: the mapping only keeps pairs where BOTH clubs exist, so a
-- re-run (or a database missing either side) is a no-op. Every write is an
-- INSERT ... ON CONFLICT DO NOTHING, a filtered UPDATE, or a DELETE.
--
-- Post-apply checks (run by hand after COMMIT; not part of the migration):
--   1. Nothing references the merged duplicates any more. The DO block at the
--      end of this file already aborts the transaction if any reference
--      remains; re-applying the file should report 0 rows changed everywhere.
--   2. Robben and Kimmich now share Bayern Munich by club id (expect 1 row,
--      club_id = tm_27):
--        SELECT a.club_id, c.name
--        FROM player_clubs a
--        JOIN player_clubs b ON b.club_id = a.club_id AND b.player_id = 'tm_161056'
--        JOIN clubs c ON c.id = a.club_id
--        WHERE a.player_id = 'tm_4360' AND c.name ILIKE '%bayern%';

BEGIN;

CREATE TEMP TABLE club_merge (
  wd_id    TEXT PRIMARY KEY,
  canon_id TEXT NOT NULL
) ON COMMIT DROP;

-- The single source of the mapping. Only pairs where both clubs exist survive
-- the JOINs, which makes every later step a safe no-op on re-run.
INSERT INTO club_merge (wd_id, canon_id)
SELECT v.wd_id, v.canon_id
FROM (VALUES
  ('wd_Q8682',     'tm_418'),    -- Real Madrid Club de Fútbol -> Real Madrid
  ('wd_Q12217',    'tm_6767'),   -- Real Madrid Castilla -> RM Castilla
  ('wd_Q10467',    'tm_2464'),   -- FC Barcelona Atlètic -> Barcelona B
  ('wd_Q2346842',  'tm_63954'),  -- FC Barcelona C -> Barcelona C
  ('wd_Q15789',    'tm_27'),     -- FC Bayern Munich -> Bayern Munich
  ('wd_Q994701',   '137964'),    -- FC Bayern Munich II -> Bayern Munich II
                                 -- HUMAN CHECK: canonical id has no tm_ prefix
                                 -- (kept verbatim from the verified mapping).
                                 -- If clubs has no id '137964' this pair is
                                 -- silently skipped by the existence guard.
  ('wd_Q8701',     'tm_13'),     -- Atlético Madrid -> Atlético de Madrid
  ('wd_Q81888',    'tm_610'),    -- AFC Ajax -> Ajax Amsterdam
  ('wd_Q32494',    'tm_33'),     -- Schalke 04 -> FC Schalke 04
  ('wd_Q51976',    'tm_86'),     -- SV Werder Bremen -> Werder Bremen
  ('wd_Q51974',    'tm_41'),     -- Hamburger SV -> Hamburger Sport Verein
  ('wd_Q10315',    'tm_681'),    -- Real Sociedad -> Real Sociedad de Fútbol S.A.D.
  ('wd_Q8749',     'tm_940'),    -- RC Celta de Vigo -> Real Club Celta de Vigo S. A. D.
  ('wd_Q19516',    'tm_1082'),   -- Lille OSC -> Lille Olympique Sporting Club
  ('wd_Q16591640', 'tm_12765'),  -- Lille OSC II -> LOSC Lille B
  ('wd_Q6601875',  'tm_36'),     -- Fenerbahçe Istanbul -> Fenerbahçe
  ('wd_Q18380286', 'tm_51828'),  -- Los Angeles FC -> LAFC
  ('wd_Q2052',     'tm_430'),    -- ACF Fiorentina -> Associazione Calcio Fiorentina
  ('wd_Q221525',   'tm_347'),    -- FC Metz -> Football Club de Metz
  ('wd_Q35933',    'tm_199'),    -- S.C. Corinthians Paulista -> Corinthians
  ('wd_Q15799',    'tm_209'),    -- Club Atlético River Plate -> River Plate
  ('wd_Q214940',   'tm_288'),    -- Estudiantes de La Plata -> Estudiantes LP
  ('wd_Q12278',    'tm_2448'),   -- Sporting de Gijón -> Sporting Gijón
  ('wd_Q193481',   'tm_197'),    -- AC Sparta Prague -> Sparta Prague
  ('wd_Q173009',   'tm_159'),    -- FK Crvena zvezda -> Red Star
  ('wd_Q215163',   'tm_1029'),   -- Club Atlético Vélez Sarsfield -> Vélez Sarsfield
  ('wd_Q499616',   'tm_866'),    -- Club Nacional de Football -> Nacional (Uruguay)
  ('wd_Q270995',   'tm_330'),    -- Clube Atlético Mineiro -> Atlético Mineiro
  ('wd_Q198032',   'tm_10010'),  -- Esporte Clube Bahia -> EC Bahia
  ('wd_Q1143000',  'tm_7633'),   -- Pumas UNAM -> UNAM Pumas
  ('wd_Q612017',   'tm_135'),    -- FK Chmel Blšany -> Chmel Blsany
  ('wd_Q857938',   'tm_6890'),   -- İstanbul Başakşehir F.K. -> Basaksehir
  ('wd_Q918044',   'tm_6182'),   -- Valencia CF Mestalla -> Valencia B
  ('wd_Q501693',   'tm_1095'),   -- ES Troyes AC -> ESTAC Troyes
  ('wd_Q1120838',  'tm_1047'),   -- Como 1907 -> Calcio Como
  ('wd_Q4384231',  'tm_9249'),   -- Arsenal F.C. Under-21s and Academy -> Arsenal U21
  ('wd_Q646088',   'tm_12100'),  -- Club Atletico All Boys -> All Boys
  ('wd_Q24938121', 'tm_49610')   -- Trastevere Calcio -> Trastevere
) AS v (wd_id, canon_id)
JOIN clubs wd    ON wd.id    = v.wd_id
JOIN clubs canon ON canon.id = v.canon_id;

-- 1. Copy career rows onto the canonical club, preserving admin-set flags.
--    DISTINCT ON guards against two wd rows collapsing onto the same key
--    (lowest pc.id wins); ON CONFLICT skips rows the canonical club already
--    has. The conflict target matches 013's player_clubs_player_club_year_loan_key.
INSERT INTO player_clubs (player_id, club_id, year_joined, year_departed, is_hidden, is_youth_team, is_loan, sort_order)
SELECT DISTINCT ON (pc.player_id, m.canon_id, pc.year_joined, pc.is_loan)
       pc.player_id, m.canon_id, pc.year_joined, pc.year_departed,
       pc.is_hidden, pc.is_youth_team, pc.is_loan, pc.sort_order
FROM player_clubs pc
JOIN club_merge m ON m.wd_id = pc.club_id
ORDER BY pc.player_id, m.canon_id, pc.year_joined, pc.is_loan, pc.id
ON CONFLICT (player_id, club_id, year_joined, is_loan) DO NOTHING;

-- 2. Delete the career rows that pointed at the duplicates.
DELETE FROM player_clubs pc
USING club_merge m
WHERE pc.club_id = m.wd_id;

-- 3. Re-point players.current_club_id (FK has no ON DELETE, so this must run
--    before the clubs delete or it would block it).
UPDATE players p
SET current_club_id = m.canon_id
FROM club_merge m
WHERE p.current_club_id = m.wd_id;

-- 4. Re-point pack_schedule.club_id (FK is ON DELETE CASCADE, so skipping this
--    would silently delete past daily packs).
UPDATE pack_schedule ps
SET club_id = m.canon_id
FROM club_merge m
WHERE ps.club_id = m.wd_id;

-- 5. Carry over crests: only fill an empty canonical badge, never overwrite.
--    Keeps any crest an admin uploaded to a wd_* club.
UPDATE clubs canon
SET badge = wd.badge
FROM club_merge m
JOIN clubs wd ON wd.id = m.wd_id
WHERE canon.id = m.canon_id
  AND canon.badge = ''
  AND wd.badge <> '';

-- 6. Delete the duplicate club rows so future backfills can't re-match them.
DELETE FROM clubs c
USING club_merge m
WHERE c.id = m.wd_id;

-- Safety net: abort the whole transaction if anything still references a
-- merged duplicate.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM player_clubs pc JOIN club_merge m ON m.wd_id = pc.club_id)
     OR EXISTS (SELECT 1 FROM players p JOIN club_merge m ON m.wd_id = p.current_club_id)
     OR EXISTS (SELECT 1 FROM pack_schedule ps JOIN club_merge m ON m.wd_id = ps.club_id)
     OR EXISTS (SELECT 1 FROM clubs c JOIN club_merge m ON m.wd_id = c.id)
  THEN
    RAISE EXCEPTION 'merge_duplicate_clubs: wd_* references remain after merge';
  END IF;
END
$$;

COMMIT;
