/**
 * Pre-populate Supabase with the 19 seed players' team data.
 *
 * Usage:
 *   npx tsx scripts/seed-players.ts
 *
 * Requires environment variables:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   VITE_SPORTSDB_API_KEY (optional, defaults to "3")
 */

import { createClient } from "@supabase/supabase-js";

// Inline seed players to avoid import.meta.env issues outside Vite
const SEED_PLAYERS = [
  { id: "34146370", name: "Lionel Messi", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/kpfsvp1725295651.jpg", nationality: "Argentina" },
  { id: "34146304", name: "Cristiano Ronaldo", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/bkre241600892282.jpg", nationality: "Portugal" },
  { id: "34146371", name: "Neymar", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/j60pdx1741319053.jpg", nationality: "Brazil" },
  { id: "34145657", name: "Wayne Rooney", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/w561fs1732109007.jpg", nationality: "England" },
  { id: "34152577", name: "Zlatan Ibrahimovic", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/rlo1p61601657280.jpg", nationality: "Sweden" },
  { id: "34161137", name: "Thierry Henry", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/vflsaf1698248867.jpg", nationality: "France" },
  { id: "34159850", name: "Ronaldinho", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/2dyq4u1533490608.jpg", nationality: "Brazil" },
  { id: "34146363", name: "Andres Iniesta", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/qcw4eh1688646504.jpg", nationality: "Spain" },
  { id: "34146362", name: "Xavi", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/njp0um1657653161.jpg", nationality: "Spain" },
  { id: "34145910", name: "Steven Gerrard", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/gyyytb1717083104.jpg", nationality: "England" },
  { id: "34145590", name: "Frank Lampard", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/qu60cy1718870905.jpg", nationality: "England" },
  { id: "34161122", name: "David Beckham", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/gwkk2t1586760011.jpg", nationality: "England" },
  { id: "34162098", name: "Kylian Mbappé", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/0yw04y1771265385.jpg", nationality: "France" },
  { id: "34146705", name: "Robert Lewandowski", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/1ogy3i1771254580.jpg", nationality: "Poland" },
  { id: "34145610", name: "Sergio Agüero", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/mxxrw91711379432.jpg", nationality: "Argentina" },
  { id: "34160533", name: "Andrea Pirlo", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/s1eujl1689493556.jpg", nationality: "Italy" },
  { id: "34146106", name: "Rio Ferdinand", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/l3ux251707938639.jpg", nationality: "England" },
  { id: "34145497", name: "John Terry", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/n2q6nq1717323527.jpg", nationality: "England" },
  { id: "34145536", name: "Didier Drogba", thumbnail: "https://r2.thesportsdb.com/images/media/player/thumb/o5en9h1710164866.jpg", nationality: "Ivory Coast" },
];

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const sportsdbKey = process.env.VITE_SPORTSDB_API_KEY || "3";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${sportsdbKey}`;

interface SportsDbFormerTeam {
  idFormerTeam: string;
  strFormerTeam: string;
  strJoined: string;
  strDeparted: string;
  strMoveType: string;
  strBadge: string | null;
}

interface SportsDbPlayer {
  idPlayer: string;
  strPlayer: string;
  strThumb: string | null;
  strNationality: string | null;
  strSport: string;
  idTeam: string | null;
  strTeam: string | null;
  dateSigned: string | null;
  strStatus?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetch(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API returned ${res.status}`);
  }
  const text = await res.text();
  if (text.startsWith("<!doctype") || text.startsWith("<")) {
    throw new Error("Rate limited (got HTML instead of JSON)");
  }
  return JSON.parse(text);
}

async function fetchFormerTeams(playerId: string) {
  const data = (await apiFetch(`${BASE_URL}/lookupformerteams.php?id=${playerId}`)) as { formerteams?: SportsDbFormerTeam[] };
  if (!data.formerteams) return [];
  return data.formerteams
    .filter((t) => t.strMoveType !== "Manager" && !t.strFormerTeam.startsWith("_"))
    .map((t) => ({
      team_id: t.idFormerTeam,
      team_name: t.strFormerTeam,
      year_joined: t.strJoined,
      year_departed: t.strDeparted,
      badge: t.strBadge ?? "",
    }));
}

async function fetchCurrentTeam(playerId: string) {
  const data = (await apiFetch(`${BASE_URL}/lookupplayer.php?id=${playerId}`)) as { players?: SportsDbPlayer[] };
  const p = data.players?.[0];
  if (!p?.idTeam || !p.strTeam || p.strStatus === "Retired" || p.strTeam.startsWith("_")) {
    return null;
  }
  return {
    team_id: p.idTeam,
    team_name: p.strTeam,
    year_joined: p.dateSigned ? p.dateSigned.substring(0, 4) : "",
    year_departed: "",
    badge: "",
  };
}

async function seedPlayer(player: typeof SEED_PLAYERS[number]) {
  // Check if already cached with teams
  const { data: existing } = await supabase
    .from("player_teams")
    .select("id")
    .eq("player_id", player.id)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log(`Skipping ${player.name} (already cached)`);
    return;
  }

  console.log(`Seeding ${player.name}...`);

  // Upsert player
  const { error: playerError } = await supabase.from("players").upsert({
    id: player.id,
    name: player.name,
    thumbnail: player.thumbnail,
    nationality: player.nationality,
  });
  if (playerError) {
    console.error(`  Failed to upsert player: ${playerError.message}`);
    return;
  }

  // Fetch teams from TheSportsDB
  const formerTeams = await fetchFormerTeams(player.id);
  await sleep(500); // Rate limit courtesy
  const currentTeam = await fetchCurrentTeam(player.id);

  const allTeams = [...formerTeams];
  if (currentTeam && !allTeams.some((t) => t.team_id === currentTeam.team_id)) {
    allTeams.push(currentTeam);
  }

  if (allTeams.length > 0) {
    // Deduplicate by (team_id, year_joined) to avoid ON CONFLICT errors
    const seen = new Set<string>();
    const uniqueTeams = allTeams.filter((t) => {
      const key = `${t.team_id}:${t.year_joined}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const rows = uniqueTeams.map((t) => ({ player_id: player.id, ...t }));
    const { error: teamsError } = await supabase
      .from("player_teams")
      .upsert(rows, { onConflict: "player_id,team_id,year_joined" });
    if (teamsError) {
      console.error(`  Failed to upsert teams: ${teamsError.message}`);
      return;
    }
  }

  console.log(`  Cached ${allTeams.length} teams`);
}

async function main() {
  console.log(`Seeding ${SEED_PLAYERS.length} players into Supabase...\n`);
  for (const player of SEED_PLAYERS) {
    await seedPlayer(player);
    await sleep(2000); // 2s delay between players for rate limiting
  }
  console.log("\nDone!");
}

main().catch(console.error);
