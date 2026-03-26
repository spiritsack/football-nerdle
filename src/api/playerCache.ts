import { supabase } from "./supabaseClient";
import { getPlayerWithTeams } from "./sportsdb";
import type { Player, PlayerWithTeams, FormerTeam } from "../types";

function sortAndMergeTeams(teams: FormerTeam[]): FormerTeam[] {
  const sorted = teams.sort((a, b) => {
    const aYear = parseInt(a.yearJoined, 10) || 9999;
    const bYear = parseInt(b.yearJoined, 10) || 9999;
    return aYear - bYear;
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
  clubs: { id: string; name: string; badge: string } | null;
}

interface PlayerRow {
  id: string;
  name: string;
  thumbnail: string;
  nationality_id: string;
  player_clubs: PlayerClubRow[];
  countries: { name: string } | null;
}

async function getFromCache(playerId: string): Promise<PlayerWithTeams | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("players")
    .select("id, name, thumbnail, nationality_id, countries(name), player_clubs(club_id, year_joined, year_departed, clubs(id, name, badge))")
    .eq("id", playerId)
    .single();

  if (error || !data) return null;

  const row = data as unknown as PlayerRow;
  if (!row.player_clubs || row.player_clubs.length === 0) return null;

  const rawTeams: FormerTeam[] = row.player_clubs
    .filter((pc) => pc.clubs)
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
  };
}

async function ensureCountry(nationality: string): Promise<void> {
  if (!supabase || !nationality) return;
  await supabase.from("countries").upsert({ id: nationality, name: nationality });
}

async function ensureClub(teamId: string, teamName: string, badge: string): Promise<void> {
  if (!supabase) return;
  if (badge) {
    // Has badge — upsert fully
    await supabase.from("clubs").upsert({ id: teamId, name: teamName, badge });
  } else {
    // No badge — only insert if club doesn't exist yet (don't overwrite existing badge)
    const { data } = await supabase.from("clubs").select("id").eq("id", teamId).single();
    if (!data) {
      await supabase.from("clubs").insert({ id: teamId, name: teamName, badge: "" });
    }
  }
}

async function saveToCache(player: PlayerWithTeams): Promise<void> {
  if (!supabase) return;

  try {
    // Ensure country exists
    await ensureCountry(player.nationality);

    // Ensure all clubs exist
    for (const t of player.formerTeams) {
      await ensureClub(t.teamId, t.teamName, t.badge);
    }

    // Upsert player
    await supabase.from("players").upsert({
      id: player.id,
      name: player.name,
      thumbnail: player.thumbnail,
      nationality_id: player.nationality || null,
    });

    // Upsert player-club relationships
    if (player.formerTeams.length > 0) {
      const seen = new Set<string>();
      const rows = player.formerTeams
        .filter((t) => {
          const key = `${t.teamId}:${t.yearJoined}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((t) => ({
          player_id: player.id,
          club_id: t.teamId,
          year_joined: t.yearJoined,
          year_departed: t.yearDeparted,
        }));

      await supabase.from("player_clubs").upsert(rows, {
        onConflict: "player_id,club_id,year_joined",
      });
    }
  } catch {
    console.warn("Failed to cache player data:", player.id);
  }
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
      .select("id, name, thumbnail, nationality_id, countries(name), player_clubs(club_id, year_joined, year_departed, clubs(id, name, badge))")
      .eq("id", playerId)
      .single();

    if (error || !data) continue;

    const row = data as unknown as PlayerRow;
    if (!row.player_clubs || row.player_clubs.length === 0) continue;

    const formerTeams = sortAndMergeTeams(row.player_clubs
      .filter((pc) => pc.clubs)
      .map((pc) => ({
        teamId: pc.clubs!.id,
        teamName: pc.clubs!.name,
        yearJoined: pc.year_joined,
        yearDeparted: pc.year_departed,
        badge: pc.clubs!.badge,
      })));

    if (formerTeams.length < MIN_CLUBS) continue;

    return {
      id: row.id,
      name: row.name,
      thumbnail: row.thumbnail,
      nationality: row.countries?.name ?? row.nationality_id ?? "",
      formerTeams,
    };
  }

  return null;
}

export async function getPlayerWithTeamsCached(player: Player): Promise<PlayerWithTeams> {
  // Try cache first
  try {
    const cached = await getFromCache(player.id);
    if (cached) return cached;
  } catch {
    // Cache read failure — fall through to API
  }

  // Fetch from TheSportsDB
  const result = await getPlayerWithTeams(player);

  // Cache in background (fire-and-forget)
  saveToCache(result);

  return result;
}
