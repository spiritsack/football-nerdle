/**
 * Copy data between Supabase instances (e.g. production → staging).
 *
 * Usage:
 *   npx tsx scripts/copy-db.ts
 *
 * Environment variables:
 *   SOURCE_SUPABASE_URL          — Source project URL
 *   SOURCE_SUPABASE_SERVICE_KEY  — Source service role key
 *   TARGET_SUPABASE_URL          — Target project URL
 *   TARGET_SUPABASE_SERVICE_KEY  — Target service role key
 *
 * This copies all rows from these tables: countries, clubs, players, player_clubs,
 * daily_schedule, pool_refresh. Target tables are cleared before copying.
 *
 * game_rooms and admin_users are NOT copied.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SOURCE_URL = process.env.SOURCE_SUPABASE_URL;
const SOURCE_KEY = process.env.SOURCE_SUPABASE_SERVICE_KEY;
const TARGET_URL = process.env.TARGET_SUPABASE_URL;
const TARGET_KEY = process.env.TARGET_SUPABASE_SERVICE_KEY;

if (!SOURCE_URL || !SOURCE_KEY || !TARGET_URL || !TARGET_KEY) {
  console.error("Missing environment variables. Required:");
  console.error("  SOURCE_SUPABASE_URL, SOURCE_SUPABASE_SERVICE_KEY");
  console.error("  TARGET_SUPABASE_URL, TARGET_SUPABASE_SERVICE_KEY");
  process.exit(1);
}

if (SOURCE_URL === TARGET_URL) {
  console.error("ERROR: Source and target are the same project! Aborting.");
  process.exit(1);
}

const source = createClient(SOURCE_URL, SOURCE_KEY);
const target = createClient(TARGET_URL, TARGET_KEY);

// Tables in dependency order (referenced tables first)
// Specify columns explicitly to avoid schema mismatches between environments
const TABLES: { name: string; columns: string }[] = [
  { name: "countries", columns: "id, name" },
  { name: "clubs", columns: "id, name, badge, league_id, country_id, is_top_club" },
  { name: "players", columns: "id, name, thumbnail, nationality_id, position, date_born, status, current_club_id, cached_at, transfermarkt_id, data_source" },
  { name: "player_clubs", columns: "id, player_id, club_id, year_joined, year_departed, is_hidden, is_youth_team, is_loan, sort_order" },
  { name: "daily_schedule", columns: "date, player_id" },
  { name: "pool_refresh", columns: "id, last_refresh, clubs_refreshed" },
];

async function fetchAll(client: SupabaseClient, table: string, columns: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await client.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    from += pageSize;
    if (data.length < pageSize) break;
  }

  return rows;
}

// Primary key column per table (for delete-all filter)
const PK_COLUMNS: Record<string, { col: string; type: "text" | "number" }> = {
  countries: { col: "id", type: "text" },
  clubs: { col: "id", type: "text" },
  players: { col: "id", type: "text" },
  player_clubs: { col: "id", type: "number" },
  daily_schedule: { col: "date", type: "text" },
  pool_refresh: { col: "id", type: "text" },
};

async function clearTable(client: SupabaseClient, table: string) {
  const pk = PK_COLUMNS[table] ?? { col: "id", type: "text" };
  const filter = pk.type === "number" ? 0 : "";
  const { error } = await client.from(table).delete().gte(pk.col, filter);
  if (error) console.warn(`  Warning: could not clear ${table}: ${error.message}`);
}

// Columns that are auto-generated and must be stripped before insert
const STRIP_COLUMNS: Record<string, string[]> = {
  player_clubs: ["id"],
};

async function insertBatch(client: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  const stripCols = STRIP_COLUMNS[table];
  const cleaned = stripCols
    ? rows.map((row) => {
        const copy = { ...row };
        for (const col of stripCols) delete copy[col];
        return copy;
      })
    : rows;

  for (let i = 0; i < cleaned.length; i += 500) {
    const batch = cleaned.slice(i, i + 500);
    const { error } = await client.from(table).upsert(batch, { ignoreDuplicates: true });
    if (error) console.warn(`  Upsert error on ${table} (batch ${Math.floor(i / 500) + 1}): ${error.message}`);
  }
}

async function main() {
  console.log("=== Database Copy ===\n");
  console.log(`Source: ${SOURCE_URL}`);
  console.log(`Target: ${TARGET_URL}\n`);

  // Clear target tables in reverse dependency order
  console.log("Clearing target tables...");
  for (const table of [...TABLES].reverse()) {
    process.stdout.write(`  ${table.name}...`);
    await clearTable(target, table.name);
    console.log(" cleared");
  }

  // Copy each table
  console.log("\nCopying data...");
  for (const table of TABLES) {
    process.stdout.write(`  ${table.name}...`);
    const rows = await fetchAll(source, table.name, table.columns);
    if (rows.length === 0) {
      console.log(" 0 rows (empty)");
      continue;
    }
    await insertBatch(target, table.name, rows);
    console.log(` ${rows.length} rows`);
  }

  console.log("\n=== Done! ===");
}

main().catch(console.error);
