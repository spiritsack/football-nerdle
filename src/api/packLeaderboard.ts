import { supabase } from "./supabaseClient";
import type { PackAttempt } from "../pages/Pack/types";

const PACK_LB_PREFIX = "football-nerdle-pack-lb-";

function getSubmittedKey(date: string): string {
  return PACK_LB_PREFIX + date;
}

export function hasSubmittedPackResult(date: string): boolean {
  try {
    return localStorage.getItem(getSubmittedKey(date)) === "1";
  } catch {
    return false;
  }
}

export async function submitPackResult(
  date: string,
  score: number,
  attempts: PackAttempt[],
): Promise<void> {
  if (!supabase) return;
  if (hasSubmittedPackResult(date)) return;

  const { error } = await supabase
    .from("pack_results")
    .insert({ date, score, attempts_json: attempts });

  if (!error) {
    try {
      localStorage.setItem(getSubmittedKey(date), "1");
    } catch {
      // ignore
    }
  }
}

export interface PackLeaderboardEntry {
  score: number;
  count: number;
}

export async function getPackLeaderboard(date: string): Promise<PackLeaderboardEntry[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("pack_results")
    .select("score")
    .eq("date", date);

  if (error || !data) return [];

  const counts = new Map<number, number>();
  for (const row of data) {
    counts.set(row.score, (counts.get(row.score) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([score, count]) => ({ score, count }))
    .sort((a, b) => a.score - b.score);
}
