import { supabase } from "./supabaseClient";
import type { Player, PlayerWithTeams, FormerTeam } from "../types";

export function sortAndMergeTeams(teams: FormerTeam[]): FormerTeam[] {
  const sorted = teams.sort((a, b) => {
    const aJoin = parseInt(a.yearJoined, 10) || 0;
    const bJoin = parseInt(b.yearJoined, 10) || 0;
    const aDep = parseInt(a.yearDeparted, 10) || 0;
    const bDep = parseInt(b.yearDeparted, 10) || 0;
    const aYear = aJoin || aDep || 9999;
    const bYear = bJoin || bDep || 9999;
    if (aYear !== bYear) return aYear - bYear;
    if (!aJoin && aDep) return -1;
    if (!bJoin && bDep) return 1;
    if (aDep !== bDep) return (aDep || 9999) - (bDep || 9999);
    return 0;
  });
  const merged: FormerTeam[] = [];
  for (const team of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.teamId === team.teamId) {
      const lastDep = parseInt(last.yearDeparted, 10) || 0;
      const currDep = parseInt(team.yearDeparted, 10) || 0;
      if (!team.yearDeparted || currDep > lastDep) {
        last.yearDeparted = team.yearDeparted;
      }
    } else {
      merged.push({ ...team });
    }
  }
  return merged;
}

interface PlayerClubRow {
  club_id: string;
  year_joined: string;
  year_departed: string;
  clubs: { id: string; name: string; badge: string } | null;
}

interface PlayerRow {
  id: string;
  name: string;
  thumbnail: string;
  nationality_id: string;
  cached_at: string;
  player_clubs: PlayerClubRow[];
  countries: { name: string } | null;
}

const PLAYER_SELECT = "id, name, thumbnail, nationality_id, cached_at, countries(name), player_clubs(club_id, year_joined, year_departed, clubs(id, name, badge))";

let countryNamesCache: Set<string> | null = null;

async function getCountryNames(): Promise<Set<string>> {
  if (countryNamesCache) return countryNamesCache;
  if (!supabase) return new Set();
  const { data } = await supabase.from("countries").select("name");
  countryNamesCache = new Set((data ?? []).map((c: { name: string }) => c.name.toLowerCase()));
  return countryNamesCache;
}

export function isNationalTeam(clubName: string, countryNames: Set<string>): boolean {
  const name = clubName.trim();
  const baseName = name.replace(/\s+(U\d+|B|Yth\.|Youth|Olympic|Olympique)$/i, "").trim();
  return countryNames.has(baseName.toLowerCase());
}

async function buildPlayerWithTeams(row: PlayerRow): Promise<PlayerWithTeams> {
  const countryNames = await getCountryNames();
  const rawTeams: FormerTeam[] = row.player_clubs
    .filter((pc) => pc.clubs)
    .filter((pc) => !isNationalTeam(pc.clubs!.name, countryNames))
    .map((pc) => ({
      teamId: pc.clubs!.id,
      teamName: pc.clubs!.name,
      yearJoined: pc.year_joined,
      yearDeparted: pc.year_departed,
      badge: pc.clubs!.badge,
    }));

  return {
    id: row.id,
    name: row.name,
    thumbnail: row.thumbnail,
    nationality: row.countries?.name ?? row.nationality_id ?? "",
    formerTeams: sortAndMergeTeams(rawTeams),
    cachedAt: row.cached_at,
  };
}

// Search players by name in Supabase
export async function searchPlayers(query: string): Promise<Player[]> {
  if (!supabase || query.length < 2) return [];

  const { data, error } = await supabase
    .from("players")
    .select("id, name, thumbnail, nationality_id, countries(name)")
    .ilike("name", `%${query}%`)
    .limit(10);

  if (error || !data) return [];

  return data.map((p: Record<string, unknown>) => {
    const countries = p.countries as { name: string }[] | { name: string } | null;
    const nationality = Array.isArray(countries) ? countries[0]?.name : countries?.name;
    return {
      id: p.id as string,
      name: p.name as string,
      thumbnail: (p.thumbnail as string) || "",
      nationality: nationality ?? (p.nationality_id as string) ?? "",
    };
  });
}

// Get a specific player by ID
export async function getFromCacheById(playerId: string): Promise<PlayerWithTeams | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .eq("id", playerId)
    .single();
  if (error || !data) return null;
  const row = data as unknown as PlayerRow;
  if (!row.player_clubs || row.player_clubs.length === 0) return null;
  return await buildPlayerWithTeams(row);
}

// Get player by ID, with name fallback for TransferMarkt matching
export async function getPlayerWithTeams(player: Player): Promise<PlayerWithTeams> {
  if (!supabase) throw new Error("Supabase not configured");

  // Try exact ID match
  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .eq("id", player.id)
    .single();

  if (!error && data) {
    const row = data as unknown as PlayerRow;
    if (row.player_clubs && row.player_clubs.length > 0) {
      return await buildPlayerWithTeams(row);
    }
  }

  // Try matching by name (handles TheSportsDB ID → TransferMarkt data)
  if (player.name) {
    const { data: tmData } = await supabase
      .from("players")
      .select(PLAYER_SELECT)
      .ilike("name", player.name)
      .limit(1)
      .single();

    if (tmData) {
      const tmRow = tmData as unknown as PlayerRow;
      if (tmRow.player_clubs && tmRow.player_clubs.length > 0) {
        return await buildPlayerWithTeams(tmRow);
      }
    }
  }

  throw new Error(`Player "${player.name}" not found in database`);
}

// Get a random player from top clubs with enough club history
const MIN_CLUBS = 3;

export async function getRandomCachedPlayer(): Promise<PlayerWithTeams | null> {
  if (!supabase) return null;

  const { data: topPlayerRows, error: topError } = await supabase
    .from("player_clubs")
    .select("player_id, clubs!inner(is_top_club)")
    .eq("clubs.is_top_club", true);

  if (topError || !topPlayerRows || topPlayerRows.length === 0) return null;

  const playerIds = [...new Set(topPlayerRows.map((r) => r.player_id))]
    .sort(() => Math.random() - 0.5);

  for (const playerId of playerIds.slice(0, 20)) {
    const { data, error } = await supabase
      .from("players")
      .select(PLAYER_SELECT)
      .eq("id", playerId)
      .single();

    if (error || !data) continue;

    const row = data as unknown as PlayerRow;
    if (!row.player_clubs || row.player_clubs.length === 0) continue;

    const player = await buildPlayerWithTeams(row);
    if (player.formerTeams.length < MIN_CLUBS) continue;

    return player;
  }

  return null;
}
