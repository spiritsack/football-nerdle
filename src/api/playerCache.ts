import { supabase } from "./supabaseClient";
import { getBaseClubName } from "../utils/clubNames";
import type { Player, PlayerWithTeams, FormerTeam } from "../types";

interface PlayerSearchRow {
  id: string;
  name: string;
  thumbnail: string;
  nationality_id: string;
  countries: { name: string } | null;
}

export async function searchPlayers(query: string): Promise<Player[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("players")
    .select("id, name, thumbnail, nationality_id, countries(name)")
    .ilike("name", `%${query}%`)
    .limit(10);
  if (error || !data) return [];
  const rows = data as unknown as PlayerSearchRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    thumbnail: row.thumbnail || "",
    nationality: row.countries?.name ?? row.nationality_id ?? "",
  }));
}

export function sortAndMergeTeams(teams: FormerTeam[]): FormerTeam[] {
  const sorted = teams.sort((a, b) => {
    const aJoin = parseInt(a.yearJoined, 10) || 0;
    const bJoin = parseInt(b.yearJoined, 10) || 0;
    const aDep = parseInt(a.yearDeparted, 10) || 0;
    const bDep = parseInt(b.yearDeparted, 10) || 0;
    const aYear = aJoin || aDep || 9999;
    const bYear = bJoin || bDep || 9999;
    if (aYear !== bYear) return aYear - bYear;
    // Same year: entry with only departure (ended here) comes before entry with join (started here)
    if (!aJoin && aDep) return -1;
    if (!bJoin && bDep) return 1;
    // Same join year: the one that departed earlier comes first
    if (aDep !== bDep) return (aDep || 9999) - (bDep || 9999);
    return 0;
  });
  // Merge consecutive stints at the same club
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
  is_hidden?: boolean;
  sort_order?: number | null;
  clubs: { id: string; name: string; badge: string } | null;
}

interface PlayerRow {
  id: string;
  name: string;
  thumbnail: string;
  nationality_id: string;
  position: string;
  date_born: string;
  cached_at: string;
  player_clubs: PlayerClubRow[];
  countries: { name: string } | null;
}

const PLAYER_SELECT = "id, name, thumbnail, nationality_id, position, date_born, cached_at, countries(name), player_clubs(club_id, year_joined, year_departed, is_hidden, sort_order, clubs(id, name, badge))";

let countryNamesCache: Set<string> | null = null;

async function getCountryNames(): Promise<Set<string>> {
  if (countryNamesCache) return countryNamesCache;
  if (!supabase) return new Set();
  const { data } = await supabase.from("countries").select("name");
  countryNamesCache = new Set((data ?? []).map((c: { name: string }) => c.name.toLowerCase()));
  return countryNamesCache;
}

export function isNationalTeam(clubName: string, countryNames: Set<string>): boolean {
  const baseName = getBaseClubName(clubName);
  return countryNames.has(baseName.toLowerCase());
}

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

async function getFromCache(playerId: string, playerName?: string): Promise<PlayerWithTeams | null> {
  if (!supabase) return null;

  // Try exact ID match first
  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_SELECT)
    .eq("id", playerId)
    .single();

  if (!error && data) {
    const row = data as unknown as PlayerRow;
    if (row.player_clubs && row.player_clubs.length > 0) {
      return await buildPlayerWithTeams(row);
    }
  }

  // If no result or no clubs, try finding a TransferMarkt-sourced player by name
  // This handles the case where search returns a TheSportsDB ID but we have better TM data
  if (playerName) {
    const { data: tmData } = await supabase
      .from("players")
      .select(PLAYER_SELECT)
      .eq("data_source", "transfermarkt")
      .ilike("name", playerName)
      .limit(1)
      .single();

    if (tmData) {
      const tmRow = tmData as unknown as PlayerRow;
      if (tmRow.player_clubs && tmRow.player_clubs.length > 0) {
        return await buildPlayerWithTeams(tmRow);
      }
    }
  }

  return null;
}

async function buildPlayerWithTeams(row: PlayerRow): Promise<PlayerWithTeams> {
  const countryNames = await getCountryNames();
  const filtered = row.player_clubs
    .filter((pc) => pc.clubs)
    .filter((pc) => !pc.is_hidden)
    .filter((pc) => !isNationalTeam(pc.clubs!.name, countryNames));

  // Use explicit sort_order if any club has one set, otherwise fall back to year-based sort
  const hasCustomOrder = filtered.some((pc) => pc.sort_order != null);

  if (hasCustomOrder) {
    filtered.sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
  }

  const rawTeams: FormerTeam[] = filtered.map((pc) => ({
    teamId: pc.clubs!.id,
    teamName: pc.clubs!.name,
    yearJoined: pc.year_joined,
    yearDeparted: pc.year_departed,
    badge: pc.clubs!.badge,
  }));

  const orderedTeams = hasCustomOrder
    ? rawTeams
    : sortAndMergeTeams(rawTeams);

  return {
    id: row.id,
    name: row.name,
    thumbnail: row.thumbnail,
    nationality: row.countries?.name ?? row.nationality_id ?? "",
    formerTeams: orderedTeams,
    cachedAt: row.cached_at,
    position: row.position || undefined,
    dateBorn: row.date_born || undefined,
  };
}

const MIN_CLUBS = 3;

export async function getRandomCachedPlayer(): Promise<PlayerWithTeams | null> {
  if (!supabase) return null;

  // Get IDs of players who play/played for a top club
  const { data: topPlayerRows, error: topError } = await supabase
    .from("player_clubs")
    .select("player_id, clubs!inner(is_top_club)")
    .eq("clubs.is_top_club", true);

  if (topError || !topPlayerRows || topPlayerRows.length === 0) return null;

  // Deduplicate and shuffle player IDs
  const playerIds = [...new Set(topPlayerRows.map((r) => r.player_id))]
    .sort(() => Math.random() - 0.5);

  // Try players until we find one with enough clubs (after merging)
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

export async function getPlayerWithTeamsCached(player: Player): Promise<PlayerWithTeams> {
  const cached = await getFromCache(player.id, player.name);
  if (cached) return cached;
  throw new Error(`Player "${player.name}" not found in database`);
}
