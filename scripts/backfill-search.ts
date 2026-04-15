/**
 * Backfill search improvements: name_search (unaccented) and popularity (market value).
 *
 * Usage:
 *   npx tsx scripts/backfill-search.ts
 *
 * Requires:
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * 1. Sets name_search = unaccented lowercase version of name for all players
 * 2. Sets popularity = highest_market_value_in_eur from TransferMarkt dataset
 */

import { createClient } from "@supabase/supabase-js";
import { createGunzip } from "zlib";
import { Readable } from "stream";
import { createInterface } from "readline";

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

/**
 * Strip diacritical marks from a string.
 * "Luka Modrić" → "luka modric"
 * "André-Pierre Gignac" → "andre-pierre gignac"
 */
function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function main() {
  console.log("=== Backfill Search Fields ===\n");

  // Step 1: Update name_search for all players
  console.log("Step 1: Backfilling name_search...");
  let from = 0;
  const pageSize = 1000;
  let nameCount = 0;

  while (true) {
    const { data, error } = await supabase
      .from("players")
      .select("id, name")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to query players: ${error.message}`);
    if (!data || data.length === 0) break;

    const updates = data.map((p: { id: string; name: string }) => ({
      id: p.id,
      name_search: removeAccents(p.name),
    }));

    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500);
      const { error: uErr } = await supabase.from("players").upsert(batch);
      if (uErr) console.warn(`  Upsert error: ${uErr.message}`);
    }

    nameCount += data.length;
    process.stdout.write(`  ${nameCount} players...\r`);
    from += pageSize;
    if (data.length < pageSize) break;
  }
  console.log(`  Updated ${nameCount} players with name_search`);

  // Step 2: Load market values from TransferMarkt
  console.log("\nStep 2: Loading market values from TransferMarkt...");
  const BASE_URL = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data";
  const url = `${BASE_URL}/players.csv.gz`;

  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Failed to fetch players.csv.gz: ${res.status}`);

  const gunzip = createGunzip();
  // @ts-ignore
  Readable.fromWeb(res.body).pipe(gunzip);
  const rl = createInterface({ input: gunzip });

  let headers: string[] = [];
  let isFirst = true;
  const marketValues = new Map<string, number>();

  for await (const line of rl) {
    if (isFirst) {
      headers = parseCsvLine(line);
      isFirst = false;
      continue;
    }
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
    const value = parseInt(row.highest_market_value_in_eur, 10);
    if (value > 0) {
      marketValues.set(`tm_${row.player_id}`, value);
    }
  }
  console.log(`  Found market values for ${marketValues.size} players`);

  // Step 3: Update popularity
  console.log("\nStep 3: Updating popularity scores...");
  const popBatch: { id: string; popularity: number }[] = [];
  let popCount = 0;

  for (const [id, value] of marketValues) {
    popBatch.push({ id, popularity: value });
    if (popBatch.length >= 500) {
      const { error } = await supabase.from("players").upsert(popBatch);
      if (error) console.warn(`  Upsert error: ${error.message}`);
      popCount += popBatch.length;
      process.stdout.write(`  ${popCount} players...\r`);
      popBatch.length = 0;
    }
  }
  if (popBatch.length > 0) {
    const { error } = await supabase.from("players").upsert(popBatch);
    if (error) console.warn(`  Upsert error: ${error.message}`);
    popCount += popBatch.length;
  }
  console.log(`  Updated ${popCount} players with popularity scores`);

  console.log("\n=== Done! ===");
}

main().catch(console.error);
