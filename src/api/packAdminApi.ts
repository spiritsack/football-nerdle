import { supabase } from "./supabaseClient";

export async function isPackScheduled(date: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("pack_schedule")
    .select("date")
    .eq("date", date)
    .maybeSingle();
  return !error && !!data;
}

export interface PublishPackResult {
  ok: boolean;
  error?: string;
}

export async function publishPack(
  date: string,
  clubId: string,
  playerIds: string[],
): Promise<PublishPackResult> {
  if (!supabase) return { ok: false, error: "Supabase unavailable" };
  if (playerIds.length !== 10) return { ok: false, error: "Pack must have exactly 10 players" };
  if (new Set(playerIds).size !== 10) return { ok: false, error: "Player list contains duplicates" };

  const { error } = await supabase
    .from("pack_schedule")
    .insert({ date, club_id: clubId, player_ids: playerIds });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
