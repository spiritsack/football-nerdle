import { supabase } from "./supabaseClient";
import { SEED_PLAYERS } from "../data/seedPlayers";
import { getPlayerWithTeamsCached } from "./playerCache";
import {
  DailyPuzzleError, MAX_FALLBACK_ATTEMPTS, NO_PUZZLE_MESSAGE, UNLOADABLE_PUZZLE_MESSAGE,
  isNoRowsError, orderFallbackCandidates, pickPlayableCandidate,
} from "./dailyFallback";
import type { Player } from "../types";

async function lookupPlayerById(id: string): Promise<Player | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("players")
    .select("id, name, thumbnail, nationality_id, countries(name)")
    .eq("id", id)
    .single();
  if (!data) return null;
  const row = data as unknown as {
    id: string; name: string; thumbnail: string; nationality_id: string;
    countries: { name: string } | null;
  };
  return {
    id: row.id,
    name: row.name,
    thumbnail: row.thumbnail || "",
    nationality: row.countries?.name ?? row.nationality_id ?? "",
  };
}

// Fallback: sequential day-number indexing when Supabase is unavailable
function fallbackDailyPlayer(date: string): Player {
  const start = new Date("2026-03-24");
  const current = new Date(date);
  const dayNum = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return SEED_PLAYERS[(dayNum - 1) % SEED_PLAYERS.length];
}

/** A player the daily can show: their club history loads with at least one visible club. */
async function isPlayableDailyPlayer(player: Player): Promise<boolean> {
  try {
    const withTeams = await getPlayerWithTeamsCached(player);
    return withTeams.formerTeams.length > 0;
  } catch {
    return false;
  }
}

async function resolveScheduledPlayer(playerId: string): Promise<Player | null> {
  return SEED_PLAYERS.find((p) => p.id === playerId) ?? await lookupPlayerById(playerId);
}

export async function getOrCreateDailyPlayer(date: string): Promise<Player> {
  if (!supabase) return fallbackDailyPlayer(date);

  try {
    const { data: existing, error: readError } = await supabase
      .from("daily_schedule")
      .select("player_id")
      .eq("date", date)
      .single();

    // A failed read is not "no row yet": auto-picking here could replace a
    // row that exists with a different player for this one user
    if (readError && !isNoRowsError(readError)) {
      throw new DailyPuzzleError(UNLOADABLE_PUZZLE_MESSAGE);
    }

    // Today's row always wins: never swap in a random player for one user
    if (existing) {
      const player = await resolveScheduledPlayer(existing.player_id);
      if (player) return player;
      throw new DailyPuzzleError(UNLOADABLE_PUZZLE_MESSAGE);
    }

    const { data: usedRows, error: usedError } = await supabase
      .from("daily_schedule")
      .select("player_id");

    // An unknown used set could make the auto-pick repeat a player
    if (usedError) throw new DailyPuzzleError(UNLOADABLE_PUZZLE_MESSAGE);

    const usedIds = new Set((usedRows || []).map((r: { player_id: string }) => r.player_id));
    const candidates = orderFallbackCandidates(SEED_PLAYERS, usedIds);
    const picked = await pickPlayableCandidate(candidates, isPlayableDailyPlayer, MAX_FALLBACK_ATTEMPTS);
    if (!picked) throw new DailyPuzzleError(NO_PUZZLE_MESSAGE);

    // Insert — if another user beat us to it (race condition), this fails silently
    await supabase
      .from("daily_schedule")
      .insert({ date, player_id: picked.id });

    // Read back the actual winner (might differ if race condition)
    const { data: final, error: finalError } = await supabase
      .from("daily_schedule")
      .select("player_id")
      .eq("date", date)
      .single();

    // A failed read-back means our pick may not be the saved row: another
    // client may have won the race with a different player
    if (finalError && !isNoRowsError(finalError)) {
      throw new DailyPuzzleError(UNLOADABLE_PUZZLE_MESSAGE);
    }

    if (final && final.player_id !== picked.id) {
      const player = await resolveScheduledPlayer(final.player_id);
      if (player) return player;
      throw new DailyPuzzleError(UNLOADABLE_PUZZLE_MESSAGE);
    }

    return picked;
  } catch (e) {
    // Only Supabase failures fall back; a daily-puzzle error is shown to the player
    if (e instanceof DailyPuzzleError) throw e;
    return fallbackDailyPlayer(date);
  }
}

export async function getScheduledPlayerForDate(date: string): Promise<Player | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from("daily_schedule")
      .select("player_id")
      .eq("date", date)
      .single();
    if (!data) return null;
    return SEED_PLAYERS.find((p) => p.id === data.player_id)
      ?? await lookupPlayerById(data.player_id);
  } catch {
    return null;
  }
}

export interface ScheduleRow {
  date: string;
  player_id: string;
}

export async function getAllScheduledDays(): Promise<ScheduleRow[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("daily_schedule")
      .select("date, player_id")
      .order("date", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}
