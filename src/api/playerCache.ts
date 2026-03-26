import { supabase } from "./supabaseClient";
import { getPlayerWithTeams } from "./sportsdb";
import type { Player, PlayerWithTeams, FormerTeam } from "../types";

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

  const formerTeams: FormerTeam[] = row.player_clubs
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
    formerTeams,
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

export async function getRandomCachedPlayer(): Promise<PlayerWithTeams | null> {
  if (!supabase) return null;

  // Get IDs of players who play/played for a top club
  const { data: topPlayerRows, error: topError } = await supabase
    .from("player_clubs")
    .select("player_id, clubs!inner(is_top_club)")
    .eq("clubs.is_top_club", true);

  if (topError || !topPlayerRows || topPlayerRows.length === 0) return null;

  // Deduplicate player IDs
  const playerIds = [...new Set(topPlayerRows.map((r) => r.player_id))];
  const randomId = playerIds[Math.floor(Math.random() * playerIds.length)];

  // Fetch full player with clubs
  const { data, error } = await supabase
    .from("players")
    .select("id, name, thumbnail, nationality_id, countries(name), player_clubs(club_id, year_joined, year_departed, clubs(id, name, badge))")
    .eq("id", randomId)
    .single();

  if (error || !data) return null;

  const row = data as unknown as PlayerRow;
  if (!row.player_clubs || row.player_clubs.length === 0) return null;

  return {
    id: row.id,
    name: row.name,
    thumbnail: row.thumbnail,
    nationality: row.countries?.name ?? row.nationality_id ?? "",
    formerTeams: row.player_clubs
      .filter((pc) => pc.clubs)
      .map((pc) => ({
        teamId: pc.clubs!.id,
        teamName: pc.clubs!.name,
        yearJoined: pc.year_joined,
        yearDeparted: pc.year_departed,
        badge: pc.clubs!.badge,
      })),
  };
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
