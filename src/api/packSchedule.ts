import { supabase } from "./supabaseClient";
import { getFromCacheById } from "./playerCache";
import type { PackData } from "../pages/Pack/types";

interface PackScheduleRow {
  date: string;
  club_id: string;
  player_ids: string[];
  clubs: { id: string; name: string; badge: string } | null;
}

export async function getPackForDate(date: string): Promise<PackData | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("pack_schedule")
    .select("date, club_id, player_ids, clubs(id, name, badge)")
    .eq("date", date)
    .single();

  if (error || !data) return null;
  const row = data as unknown as PackScheduleRow;
  if (!row.clubs) return null;

  const players = await Promise.all(row.player_ids.map((id) => getFromCacheById(id)));
  const valid = players.filter((p): p is NonNullable<typeof p> => p !== null);
  if (valid.length === 0) return null;

  return {
    date: row.date,
    club: { id: row.clubs.id, name: row.clubs.name, badge: row.clubs.badge },
    players: valid,
  };
}
