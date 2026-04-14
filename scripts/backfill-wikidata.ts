/**
 * Backfill missing player club history from Wikidata.
 *
 * Many players imported from TransferMarkt have profiles but no transfer records.
 * Wikidata has career station data (P54) for many footballers, matched via
 * TransferMarkt player ID (P2446).
 *
 * Usage:
 *   npx tsx scripts/backfill-wikidata.ts              # Backfill all players missing transfers
 *   npx tsx scripts/backfill-wikidata.ts --dry-run     # Preview without writing to DB
 *   npx tsx scripts/backfill-wikidata.ts --player 3220  # Backfill a single player (for testing)
 *
 * Requires:
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DRY_RUN = process.argv.includes("--dry-run");
const SINGLE_PLAYER = (() => {
  const idx = process.argv.indexOf("--player");
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const BATCH_SIZE = 50;
const REQUEST_DELAY_MS = 1200; // ~50 req/min, safe under Wikidata's limit

// National team patterns to filter out
const NATIONAL_TEAM_RE = /national|olympic/i;

interface WikidataBinding {
  tm_id: { value: string };
  playerLabel: { value: string };
  team: { value: string };
  teamLabel: { value: string };
  start?: { value: string };
  end?: { value: string };
}

interface CareerEntry {
  tmId: string;
  playerName: string;
  teamWikidataId: string;
  teamName: string;
  yearJoined: string;
  yearDeparted: string;
}

function extractYear(dateStr: string): string {
  if (!dateStr) return "";
  const match = dateStr.match(/^(\d{4})/);
  return match ? match[1] : "";
}

async function queryWikidata(tmIds: string[]): Promise<CareerEntry[]> {
  const values = tmIds.map((id) => `"${id}"`).join(" ");
  const query = `SELECT ?tm_id ?playerLabel ?team ?teamLabel ?start ?end WHERE {
  VALUES ?tm_id { ${values} }
  ?player wdt:P2446 ?tm_id .
  ?player p:P54 ?statement .
  ?statement ps:P54 ?team .
  OPTIONAL { ?statement pq:P580 ?start . }
  OPTIONAL { ?statement pq:P582 ?end . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}`;

  const url = `${WIKIDATA_ENDPOINT}?${new URLSearchParams({ query, format: "json" })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "football-nerdle/1.0 (https://github.com/spiritsack/football-nerdle)" },
  });

  if (!res.ok) {
    if (res.status === 429) {
      console.warn("  Rate limited, waiting 30s...");
      await sleep(30000);
      return queryWikidata(tmIds); // retry
    }
    throw new Error(`Wikidata query failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const bindings: WikidataBinding[] = data.results.bindings;

  return bindings
    .filter((b) => !NATIONAL_TEAM_RE.test(b.teamLabel.value))
    .map((b) => ({
      tmId: b.tm_id.value,
      playerName: b.playerLabel.value,
      teamWikidataId: b.team.value.split("/").pop()!,
      teamName: b.teamLabel.value,
      yearJoined: extractYear(b.start?.value ?? ""),
      yearDeparted: extractYear(b.end?.value ?? ""),
    }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertBatch(table: string, rows: Record<string, unknown>[], onConflict?: string, ignoreDuplicates?: boolean) {
  if (rows.length === 0) return;
  const opts: Record<string, unknown> = {};
  if (onConflict) opts.onConflict = onConflict;
  if (ignoreDuplicates) opts.ignoreDuplicates = true;
  const { error } = await supabase.from(table).upsert(rows, opts);
  if (error) console.warn(`  Upsert error on ${table}: ${error.message}`);
}

async function fetchAllRows<T>(table: string, select: string, filter?: { column: string; value: string }): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (filter) query = query.eq(filter.column, filter.value);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to query ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    from += pageSize;
    if (data.length < pageSize) break;
  }

  return rows;
}

async function getPlayersMissingTransfers(): Promise<{ id: string; tmId: string }[]> {
  if (SINGLE_PLAYER) {
    return [{ id: `tm_${SINGLE_PLAYER}`, tmId: SINGLE_PLAYER }];
  }

  // Get all player IDs that have at least one player_clubs entry
  const withClubs = await fetchAllRows<{ player_id: string }>("player_clubs", "player_id");
  const hasClubs = new Set(withClubs.map((r) => r.player_id));

  // Get all players with TransferMarkt data source
  const allPlayers = await fetchAllRows<{ id: string; transfermarkt_id: string }>(
    "players", "id, transfermarkt_id", { column: "data_source", value: "transfermarkt" }
  );

  return allPlayers
    .filter((p) => !hasClubs.has(p.id) && p.transfermarkt_id)
    .map((p) => ({ id: p.id, tmId: p.transfermarkt_id }));
}

/**
 * Normalize club name for matching: strip common suffixes, punctuation differences.
 * "Liverpool F.C." → "liverpool fc"
 * "Fulham Football Club" → "fulham fc"
 * "AS Monaco FC" → "as monaco fc"
 */
function normalizeClubName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bfootball club\b/g, "fc")
    .replace(/f\.c\./g, "fc")
    .replace(/a\.c\./g, "ac")
    .replace(/s\.c\./g, "sc")
    .replace(/a\.s\./g, "as")
    .replace(/s\.s\.c\./g, "ssc")
    .replace(/s\.l\./g, "sl")
    .replace(/c\.f\./g, "cf")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip trailing abbreviations entirely for loose matching.
 * "AS Monaco FC" → "as monaco"
 * "Liverpool FC" → "liverpool"
 */
function stripClubSuffix(name: string): string {
  return normalizeClubName(name)
    .replace(/\s+(fc|ac|sc|ssc|sl|cf|fk|bk|sk|if|ff|afc|sfc|cfc)$/g, "")
    .trim();
}

async function loadClubNameMap(): Promise<Map<string, string>> {
  // Build maps of club name -> club ID for matching
  // Store both exact lowercase and normalized versions
  const map = new Map<string, string>();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("clubs")
      .select("id, name")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to query clubs: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const club of data) {
      map.set(club.name.toLowerCase(), club.id);
      map.set(normalizeClubName(club.name), club.id);
      map.set(stripClubSuffix(club.name), club.id);
    }
    from += pageSize;
    if (data.length < pageSize) break;
  }

  return map;
}

async function main() {
  console.log("=== Wikidata Career Backfill ===\n");
  if (DRY_RUN) console.log("DRY RUN — no data will be written\n");

  // Step 1: Find players missing transfers
  console.log("Step 1: Finding players missing club history...");
  const players = await getPlayersMissingTransfers();
  console.log(`  Found ${players.length} players without club history\n`);

  if (players.length === 0) {
    console.log("Nothing to do!");
    return;
  }

  // Step 2: Load existing club names for matching
  console.log("Step 2: Loading club name index...");
  const clubNameMap = await loadClubNameMap();
  console.log(`  Loaded ${clubNameMap.size} clubs\n`);

  // Step 3: Query Wikidata in batches
  console.log("Step 3: Querying Wikidata for career data...");
  const tmIds = players.map((p) => p.tmId);
  let totalEntries = 0;
  let playersWithData = 0;
  let clubsMatched = 0;
  let clubsCreated = 0;
  let pcInserted = 0;
  const playersSeen = new Set<string>();
  const newClubs: Record<string, unknown>[] = [];
  const pcBatch: Record<string, unknown>[] = [];

  for (let i = 0; i < tmIds.length; i += BATCH_SIZE) {
    const batch = tmIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(tmIds.length / BATCH_SIZE);

    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} players)...`);

    let entries: CareerEntry[];
    try {
      entries = await queryWikidata(batch);
    } catch (err) {
      console.error(` ERROR: ${err}`);
      continue;
    }

    totalEntries += entries.length;

    for (const entry of entries) {
      playersSeen.add(entry.tmId);

      // Match club: try exact lowercase, then normalized, then stripped suffix
      let clubId = clubNameMap.get(entry.teamName.toLowerCase())
        || clubNameMap.get(normalizeClubName(entry.teamName))
        || clubNameMap.get(stripClubSuffix(entry.teamName));

      if (!clubId) {
        // Create new club entry
        clubId = `wd_${entry.teamWikidataId}`;
        const normalized = normalizeClubName(entry.teamName);
        if (!clubNameMap.has(normalized)) {
          clubNameMap.set(entry.teamName.toLowerCase(), clubId);
          clubNameMap.set(normalized, clubId);
          newClubs.push({
            id: clubId,
            name: entry.teamName,
            badge: "",
          });
          clubsCreated++;
        }
      } else {
        clubsMatched++;
      }

      pcBatch.push({
        player_id: `tm_${entry.tmId}`,
        club_id: clubId,
        year_joined: entry.yearJoined,
        year_departed: entry.yearDeparted,
      });
    }

    const found = new Set(entries.map((e) => e.tmId)).size;
    console.log(` ${entries.length} career entries for ${found} players`);

    // Flush batches periodically
    if (!DRY_RUN && (pcBatch.length >= 500 || i + BATCH_SIZE >= tmIds.length)) {
      // Insert new clubs first
      if (newClubs.length > 0) {
        await upsertBatch("clubs", newClubs, undefined, true);
        newClubs.length = 0;
      }
      // Then player_clubs
      pcInserted += pcBatch.length;
      await upsertBatch("player_clubs", pcBatch, "player_id,club_id,year_joined");
      pcBatch.length = 0;
    }

    if (i + BATCH_SIZE < tmIds.length) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  playersWithData = playersSeen.size;

  // Flush remaining
  if (!DRY_RUN && (newClubs.length > 0 || pcBatch.length > 0)) {
    if (newClubs.length > 0) {
      await upsertBatch("clubs", newClubs, undefined, true);
    }
    pcInserted += pcBatch.length;
    await upsertBatch("player_clubs", pcBatch, "player_id,club_id,year_joined");
  }

  console.log(`\n=== Results ===`);
  console.log(`  Players queried: ${tmIds.length}`);
  console.log(`  Players with Wikidata career data: ${playersWithData} (${Math.round(playersWithData / tmIds.length * 100)}%)`);
  console.log(`  Total career entries: ${totalEntries}`);
  console.log(`  Clubs matched to existing: ${clubsMatched}`);
  console.log(`  New clubs created: ${clubsCreated}`);
  if (!DRY_RUN) {
    console.log(`  Player-club records inserted: ${pcInserted}`);
  } else {
    console.log(`  Player-club records (would insert): ${pcBatch.length + pcInserted}`);
  }
}

main().catch(console.error);
