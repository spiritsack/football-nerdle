import { supabase } from "./supabaseClient";
import { SEED_PLAYERS } from "../data/seedPlayers";
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

export async function getOrCreateDailyPlayer(date: string): Promise<Player> {
  if (!supabase) return fallbackDailyPlayer(date);

  try {
    const { data: existing } = await supabase
      .from("daily_schedule")
      .select("player_id")
      .eq("date", date)
      .single();

    if (existing) {
      const player = SEED_PLAYERS.find((p) => p.id === existing.player_id)
        ?? await lookupPlayerById(existing.player_id);
      if (player) return player;
    }

    const { data: usedRows } = await supabase
      .from("daily_schedule")
      .select("player_id");

    const usedIds = new Set((usedRows || []).map((r: { player_id: string }) => r.player_id));
    const unused = SEED_PLAYERS.filter((p) => !usedIds.has(p.id));
    const pool = unused.length > 0 ? unused : SEED_PLAYERS;
    const picked = pool[Math.floor(Math.random() * pool.length)];

    // Insert — if another user beat us to it (race condition), this fails silently
    await supabase
      .from("daily_schedule")
      .insert({ date, player_id: picked.id });

    // Read back the actual winner (might differ if race condition)
    const { data: final } = await supabase
      .from("daily_schedule")
      .select("player_id")
      .eq("date", date)
      .single();

    if (final) {
      const player = SEED_PLAYERS.find((p) => p.id === final.player_id)
        ?? await lookupPlayerById(final.player_id);
      if (player) return player;
    }

    return picked;
  } catch {
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
