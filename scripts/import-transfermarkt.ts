/**
 * Import player and transfer data from TransferMarkt datasets into Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-transfermarkt.ts
 *
 * Requires:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
 *
 * Data source: https://github.com/dcaribou/transfermarkt-datasets
 */

import { createClient } from "@supabase/supabase-js";
import { createGunzip } from "zlib";
import { Readable } from "stream";
import { createInterface } from "readline";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BASE_URL = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data";

// Top 5 leagues + Portuguese + Dutch first divisions
const TARGET_COMPETITIONS = new Set(["GB1", "ES1", "IT1", "L1", "FR1", "PO1", "NL1"]);

interface CsvPlayer {
  player_id: string;
  name: string;
  first_name: string;
  last_name: string;
  country_of_citizenship: string;
  date_of_birth: string;
  position: string;
  sub_position: string;
  image_url: string;
  current_club_id: string;
  current_club_name: string;
  current_club_domestic_competition_id: string;
  market_value_in_eur: string;
}

interface CsvTransfer {
  player_id: string;
  transfer_date: string;
  from_club_id: string;
  to_club_id: string;
  from_club_name: string;
  to_club_name: string;
  player_name: string;
}

interface CsvClub {
  club_id: string;
  name: string;
  domestic_competition_id: string;
}

async function* readCsvGz<T>(filename: string, filter?: (row: T) => boolean): AsyncGenerator<T> {
  const url = `${BASE_URL}/${filename}.csv.gz`;
  console.log(`Downloading ${filename}...`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const gunzip = createGunzip();
  // @ts-ignore - Node stream compatibility
  Readable.fromWeb(res.body).pipe(gunzip);

  const rl = createInterface({ input: gunzip });
  let headers: string[] = [];
  let isFirst = true;

  for await (const line of rl) {
    if (isFirst) {
      headers = parseCsvLine(line);
      isFirst = false;
      continue;
    }
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])) as T;
    if (!filter || filter(row)) yield row;
  }
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

function extractYear(dateStr: string): string {
  if (!dateStr) return "";
  const match = dateStr.match(/^(\d{4})/);
  return match ? match[1] : "";
}

async function upsertBatch(table: string, rows: Record<string, unknown>[], onConflict?: string) {
  if (rows.length === 0) return;
  const opts = onConflict ? { onConflict } : undefined;
  const { error } = await supabase.from(table).upsert(rows, opts);
  if (error) console.warn(`  Upsert error on ${table}: ${error.message}`);
}

async function main() {
  console.log("=== TransferMarkt Data Import ===\n");

  // Step 1: Load clubs from target competitions
  console.log("Step 1: Loading clubs...");
  const clubMap = new Map<string, { id: string; name: string; competition: string }>();
  const clubRows: Record<string, unknown>[] = [];

  for await (const club of readCsvGz<CsvClub>("clubs", (c) => TARGET_COMPETITIONS.has(c.domestic_competition_id))) {
    clubMap.set(club.club_id, { id: club.club_id, name: club.name, competition: club.domestic_competition_id });
    clubRows.push({
      id: `tm_${club.club_id}`,
      name: club.name,
      transfermarkt_id: club.club_id,
      league_id: club.domestic_competition_id,
    });
  }
  console.log(`  Found ${clubMap.size} clubs in target competitions`);

  // Batch upsert clubs
  for (let i = 0; i < clubRows.length; i += 500) {
    await upsertBatch("clubs", clubRows.slice(i, i + 500));
  }
  console.log(`  Upserted ${clubRows.length} clubs`);

  // Step 2: Load players from target competitions
  console.log("\nStep 2: Loading players...");
  const targetPlayerIds = new Set<string>();
  const playerRows: Record<string, unknown>[] = [];
  const countrySet = new Set<string>();

  for await (const player of readCsvGz<CsvPlayer>("players", (p) =>
    TARGET_COMPETITIONS.has(p.current_club_domestic_competition_id) &&
    p.position !== "" &&
    p.position !== "Manager"
  )) {
    targetPlayerIds.add(player.player_id);
    const nationality = player.country_of_citizenship || "";
    if (nationality) countrySet.add(nationality);

    playerRows.push({
      id: `tm_${player.player_id}`,
      name: player.name || `${player.first_name} ${player.last_name}`.trim(),
      thumbnail: player.image_url || "",
      nationality_id: nationality || null,
      position: player.sub_position || player.position || "",
      date_born: extractYear(player.date_of_birth),
      status: "Active",
      current_club_id: clubMap.has(player.current_club_id) ? `tm_${player.current_club_id}` : null,
      transfermarkt_id: player.player_id,
      data_source: "transfermarkt",
    });
  }
  console.log(`  Found ${targetPlayerIds.size} players`);

  // Upsert countries
  const countryRows = [...countrySet].map((c) => ({ id: c, name: c }));
  for (let i = 0; i < countryRows.length; i += 500) {
    await upsertBatch("countries", countryRows.slice(i, i + 500));
  }
  console.log(`  Upserted ${countrySet.size} countries`);

  // Batch upsert players
  for (let i = 0; i < playerRows.length; i += 500) {
    await upsertBatch("players", playerRows.slice(i, i + 500));
  }
  console.log(`  Upserted ${playerRows.length} players`);

  // Step 3: Load transfers for target players
  console.log("\nStep 3: Loading transfers...");

  // Build transfer history: for each player, collect all clubs they played for
  // A transfer record means: player left from_club and joined to_club on transfer_date
  const playerClubs = new Map<string, Map<string, { clubId: string; clubName: string; joined: string; departed: string }>>();

  let transferCount = 0;
  for await (const transfer of readCsvGz<CsvTransfer>("transfers", (t) => targetPlayerIds.has(t.player_id))) {
    transferCount++;
    const pid = transfer.player_id;
    if (!playerClubs.has(pid)) playerClubs.set(pid, new Map());
    const clubs = playerClubs.get(pid)!;

    const year = extractYear(transfer.transfer_date);

    // The player departed from_club on this date
    if (transfer.from_club_id && transfer.from_club_id !== "0") {
      const key = `${transfer.from_club_id}`;
      const existing = clubs.get(key);
      if (existing) {
        // Update departure year if this is later
        if (!existing.departed || (year && year > existing.departed)) {
          existing.departed = year;
        }
      } else {
        clubs.set(key, {
          clubId: transfer.from_club_id,
          clubName: transfer.from_club_name,
          joined: "",
          departed: year,
        });
      }
    }

    // The player joined to_club on this date
    if (transfer.to_club_id && transfer.to_club_id !== "0") {
      const key = `${transfer.to_club_id}`;
      const existing = clubs.get(key);
      if (existing) {
        // Update join year if this is earlier
        if (!existing.joined || (year && year < existing.joined)) {
          existing.joined = year;
        }
      } else {
        clubs.set(key, {
          clubId: transfer.to_club_id,
          clubName: transfer.to_club_name,
          joined: year,
          departed: "",
        });
      }
    }
  }
  console.log(`  Processed ${transferCount} transfer records for ${playerClubs.size} players`);

  // Ensure all clubs from transfers exist
  console.log("\nStep 4: Ensuring transfer clubs exist...");
  const extraClubs: Record<string, unknown>[] = [];
  const seenClubs = new Set(clubMap.keys());

  for (const clubs of playerClubs.values()) {
    for (const club of clubs.values()) {
      if (!seenClubs.has(club.clubId)) {
        seenClubs.add(club.clubId);
        extraClubs.push({
          id: `tm_${club.clubId}`,
          name: club.clubName,
          transfermarkt_id: club.clubId,
        });
      }
    }
  }
  for (let i = 0; i < extraClubs.length; i += 500) {
    await upsertBatch("clubs", extraClubs.slice(i, i + 500));
  }
  console.log(`  Upserted ${extraClubs.length} extra clubs from transfers`);

  // Step 5: Insert player_clubs
  console.log("\nStep 5: Inserting player club history...");
  let pcTotal = 0;
  const pcBatch: Record<string, unknown>[] = [];

  for (const [playerId, clubs] of playerClubs) {
    for (const club of clubs.values()) {
      pcBatch.push({
        player_id: `tm_${playerId}`,
        club_id: `tm_${club.clubId}`,
        year_joined: club.joined,
        year_departed: club.departed,
      });
      pcTotal++;

      if (pcBatch.length >= 500) {
        await upsertBatch("player_clubs", pcBatch, "player_id,club_id,year_joined");
        pcBatch.length = 0;
      }
    }
  }
  if (pcBatch.length > 0) {
    await upsertBatch("player_clubs", pcBatch, "player_id,club_id,year_joined");
  }
  console.log(`  Inserted ${pcTotal} player-club records`);

  // Step 6: Mark top clubs
  console.log("\nStep 6: Marking top clubs...");
  const topClubNames = [
    "Arsenal FC", "Chelsea FC", "Liverpool FC", "Manchester City", "Manchester United",
    "Tottenham Hotspur", "Real Madrid CF", "FC Barcelona", "Atlético de Madrid",
    "Juventus FC", "AC Milan", "Inter Milan", "SSC Napoli",
    "FC Bayern München", "Borussia Dortmund",
    "Paris Saint-Germain", "Olympique de Marseille", "Olympique Lyonnais",
    "AFC Ajax", "FC Porto", "SL Benfica",
  ];
  for (const name of topClubNames) {
    const { error } = await supabase.from("clubs").update({ is_top_club: true }).eq("name", name);
    if (error) {
      // Try partial match
      const { data } = await supabase.from("clubs").select("id, name").ilike("name", `%${name.split(" ")[0]}%`).limit(5);
      if (data && data.length > 0) {
        console.log(`  "${name}" not found exact, candidates: ${data.map((d: { name: string }) => d.name).join(", ")}`);
      }
    }
  }

  // Final counts
  const { count: pc } = await supabase.from("players").select("id", { count: "exact", head: true });
  const { count: cc } = await supabase.from("clubs").select("id", { count: "exact", head: true });
  const { count: pcc } = await supabase.from("player_clubs").select("id", { count: "exact", head: true });

  console.log(`\n=== Done! ===`);
  console.log(`  Players: ${pc}`);
  console.log(`  Clubs: ${cc}`);
  console.log(`  Player-club links: ${pcc}`);
}

main().catch(console.error);
