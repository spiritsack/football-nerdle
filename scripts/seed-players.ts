/**
 * Pre-populate Supabase with players from top clubs.
 *
 * Usage:
 *   npx tsx scripts/seed-players.ts
 *
 * Requires environment variables:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
 *   VITE_SPORTSDB_API_KEY (optional, defaults to "3")
 */

import { createClient } from "@supabase/supabase-js";

const TOP_CLUBS = [
  { id: "133604", name: "Arsenal", league: "English Premier League", country: "England" },
  { id: "133610", name: "Chelsea", league: "English Premier League", country: "England" },
  { id: "133602", name: "Liverpool", league: "English Premier League", country: "England" },
  { id: "133613", name: "Manchester City", league: "English Premier League", country: "England" },
  { id: "133612", name: "Manchester United", league: "English Premier League", country: "England" },
  { id: "133616", name: "Tottenham Hotspur", league: "English Premier League", country: "England" },
  { id: "133738", name: "Real Madrid", league: "Spanish La Liga", country: "Spain" },
  { id: "133739", name: "Barcelona", league: "Spanish La Liga", country: "Spain" },
  { id: "133729", name: "Atlético Madrid", league: "Spanish La Liga", country: "Spain" },
  { id: "133676", name: "Juventus", league: "Italian Serie A", country: "Italy" },
  { id: "133667", name: "AC Milan", league: "Italian Serie A", country: "Italy" },
  { id: "133681", name: "Inter Milan", league: "Italian Serie A", country: "Italy" },
  { id: "133670", name: "Napoli", league: "Italian Serie A", country: "Italy" },
  { id: "133664", name: "Bayern Munich", league: "German Bundesliga", country: "Germany" },
  { id: "133650", name: "Borussia Dortmund", league: "German Bundesliga", country: "Germany" },
  { id: "133714", name: "Paris SG", league: "French Ligue 1", country: "France" },
  { id: "133707", name: "Marseille", league: "French Ligue 1", country: "France" },
  { id: "133713", name: "Lyon", league: "French Ligue 1", country: "France" },
  { id: "133772", name: "Ajax", league: "Dutch Eredivisie", country: "Netherlands" },
  { id: "134114", name: "FC Porto", league: "Portuguese Primeira Liga", country: "Portugal" },
  { id: "134108", name: "Benfica", league: "Portuguese Primeira Liga", country: "Portugal" },
];

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
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
  strCutout: string | null;
  strNationality: string | null;
  strSport: string;
  idTeam: string | null;
  strTeam: string | null;
  dateSigned: string | null;
  strStatus?: string;
  strPosition?: string;
  dateBorn?: string;
  strGender?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetch(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const text = await res.text();
  if (text.startsWith("<!doctype") || text.startsWith("<")) {
    throw new Error("Rate limited (got HTML instead of JSON)");
  }
  return JSON.parse(text);
}

async function ensureCountry(nationality: string) {
  if (!nationality) return;
  await supabase.from("countries").upsert({ id: nationality, name: nationality });
}

async function ensureClub(id: string, name: string, badge: string = "", opts?: { isTopClub?: boolean; league?: string; country?: string }) {
  const row: Record<string, unknown> = { id, name, badge };
  if (opts?.isTopClub) row.is_top_club = true;
  if (opts?.league) row.league_id = opts.league;
  if (opts?.country) {
    await ensureCountry(opts.country);
    row.country_id = opts.country;
  }
  await supabase.from("clubs").upsert(row);
}

async function fetchFormerTeams(playerId: string) {
  const data = (await apiFetch(`${BASE_URL}/lookupformerteams.php?id=${playerId}`)) as { formerteams?: SportsDbFormerTeam[] };
  if (!data.formerteams) return [];
  return data.formerteams
    .filter((t) => t.strMoveType !== "Manager" && !t.strFormerTeam.startsWith("_"));
}

async function fetchCurrentTeam(playerId: string) {
  const data = (await apiFetch(`${BASE_URL}/lookupplayer.php?id=${playerId}`)) as { players?: SportsDbPlayer[] };
  const p = data.players?.[0];
  if (!p?.idTeam || !p.strTeam || p.strStatus === "Retired" || p.strTeam.startsWith("_")) {
    return null;
  }
  return {
    teamId: p.idTeam,
    teamName: p.strTeam,
    yearJoined: p.dateSigned ? p.dateSigned.substring(0, 4) : "",
  };
}

async function fetchTeamRoster(teamId: string): Promise<SportsDbPlayer[]> {
  const data = (await apiFetch(`${BASE_URL}/lookup_all_players.php?id=${teamId}`)) as { player?: SportsDbPlayer[] };
  if (!data.player) return [];
  return data.player.filter((p) => p.strSport === "Soccer" && p.strGender === "Male");
}

async function seedPlayer(player: { id: string; name: string; thumbnail: string; nationality: string }) {
  // Check if already cached with clubs
  const { data: existing } = await supabase
    .from("player_clubs")
    .select("id")
    .eq("player_id", player.id)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log(`  Skipping ${player.name} (already cached)`);
    return;
  }

  console.log(`  Seeding ${player.name}...`);

  await ensureCountry(player.nationality);

  // Upsert player
  await supabase.from("players").upsert({
    id: player.id,
    name: player.name,
    thumbnail: player.thumbnail,
    nationality_id: player.nationality || null,
  });

  // Fetch teams from TheSportsDB
  let formerTeams: SportsDbFormerTeam[] = [];
  try {
    formerTeams = await fetchFormerTeams(player.id);
  } catch (e) {
    console.warn(`    Failed to fetch former teams: ${e}`);
    return;
  }
  await sleep(500);

  let currentTeam: { teamId: string; teamName: string; yearJoined: string } | null = null;
  try {
    currentTeam = await fetchCurrentTeam(player.id);
  } catch (e) {
    console.warn(`    Failed to fetch current team: ${e}`);
  }

  // Build club list
  const clubs: { id: string; name: string; badge: string; yearJoined: string; yearDeparted: string }[] = [];

  const seen = new Set<string>();
  for (const t of formerTeams) {
    const key = `${t.idFormerTeam}:${t.strJoined}`;
    if (seen.has(key)) continue;
    seen.add(key);
    clubs.push({
      id: t.idFormerTeam,
      name: t.strFormerTeam,
      badge: t.strBadge ?? "",
      yearJoined: t.strJoined,
      yearDeparted: t.strDeparted,
    });
  }

  if (currentTeam && !clubs.some((c) => c.id === currentTeam!.teamId)) {
    clubs.push({
      id: currentTeam.teamId,
      name: currentTeam.teamName,
      badge: "",
      yearJoined: currentTeam.yearJoined,
      yearDeparted: "",
    });
  }

  // Ensure all clubs exist
  for (const c of clubs) {
    await ensureClub(c.id, c.name, c.badge);
  }

  // Insert player_clubs
  if (clubs.length > 0) {
    const rows = clubs.map((c) => ({
      player_id: player.id,
      club_id: c.id,
      year_joined: c.yearJoined,
      year_departed: c.yearDeparted,
    }));
    const { error } = await supabase
      .from("player_clubs")
      .upsert(rows, { onConflict: "player_id,club_id,year_joined" });
    if (error) {
      console.warn(`    Failed to upsert clubs: ${error.message}`);
    } else {
      console.log(`    Cached ${clubs.length} clubs`);
    }
  }
}

async function seedTopClub(club: typeof TOP_CLUBS[number]) {
  console.log(`\n=== ${club.name} ===`);

  // Ensure club exists with is_top_club flag, league, and country
  await ensureClub(club.id, club.name, "", { isTopClub: true, league: club.league, country: club.country });

  // Fetch roster
  let roster: SportsDbPlayer[];
  try {
    roster = await fetchTeamRoster(club.id);
  } catch (e) {
    console.error(`  Failed to fetch roster: ${e}`);
    return;
  }

  console.log(`  Found ${roster.length} players`);

  for (const p of roster) {
    await seedPlayer({
      id: p.idPlayer,
      name: p.strPlayer,
      thumbnail: p.strThumb ?? p.strCutout ?? "",
      nationality: p.strNationality ?? "",
    });
    await sleep(1500);
  }
}

async function main() {
  console.log(`Seeding ${TOP_CLUBS.length} top clubs into Supabase...\n`);

  for (const club of TOP_CLUBS) {
    await seedTopClub(club);
    await sleep(2000);
  }

  // Count totals
  const { count: playerCount } = await supabase.from("players").select("id", { count: "exact", head: true });
  const { count: clubCount } = await supabase.from("clubs").select("id", { count: "exact", head: true });
  const { count: countryCount } = await supabase.from("countries").select("id", { count: "exact", head: true });

  console.log(`\nDone!`);
  console.log(`  Players: ${playerCount}`);
  console.log(`  Clubs: ${clubCount}`);
  console.log(`  Countries: ${countryCount}`);
}

main().catch(console.error);
