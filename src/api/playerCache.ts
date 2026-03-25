import { supabase } from "./supabaseClient";
import { getPlayerWithTeams } from "./sportsdb";
import type { Player, PlayerWithTeams, FormerTeam } from "../types";

interface PlayerTeamRow {
  team_id: string;
  team_name: string;
  year_joined: string;
  year_departed: string;
  badge: string;
}

interface PlayerRow {
  id: string;
  name: string;
  thumbnail: string;
  nationality: string;
  player_teams: PlayerTeamRow[];
}

async function getFromCache(playerId: string): Promise<PlayerWithTeams | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("players")
    .select("id, name, thumbnail, nationality, player_teams(team_id, team_name, year_joined, year_departed, badge)")
    .eq("id", playerId)
    .single();

  if (error || !data) return null;

  const row = data as unknown as PlayerRow;
  const formerTeams: FormerTeam[] = row.player_teams.map((t) => ({
    teamId: t.team_id,
    teamName: t.team_name,
    yearJoined: t.year_joined,
    yearDeparted: t.year_departed,
    badge: t.badge,
  }));

  return {
    id: row.id,
    name: row.name,
    thumbnail: row.thumbnail,
    nationality: row.nationality,
    formerTeams,
  };
}

async function saveToCache(player: PlayerWithTeams): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.from("players").upsert({
      id: player.id,
      name: player.name,
      thumbnail: player.thumbnail,
      nationality: player.nationality,
    });

    if (player.formerTeams.length > 0) {
      const teamRows = player.formerTeams.map((t) => ({
        player_id: player.id,
        team_id: t.teamId,
        team_name: t.teamName,
        year_joined: t.yearJoined,
        year_departed: t.yearDeparted,
        badge: t.badge,
      }));

      await supabase.from("player_teams").upsert(teamRows, {
        onConflict: "player_id,team_id,year_joined",
      });
    }
  } catch {
    // Cache write failures are non-critical — log and continue
    console.warn("Failed to cache player data:", player.id);
  }
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
