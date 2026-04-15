import { supabase } from "./supabaseClient";

const LB_SUBMITTED_PREFIX = "football-nerdle-lb-";

function getSubmittedKey(date: string): string {
  return LB_SUBMITTED_PREFIX + date;
}

export function hasSubmittedResult(date: string): boolean {
  return localStorage.getItem(getSubmittedKey(date)) === "1";
}

export async function submitDailyResult(date: string, won: boolean, attempts: number): Promise<void> {
  if (!supabase) return;
  if (hasSubmittedResult(date)) return;

  const { error } = await supabase
    .from("daily_results")
    .insert({ date, attempts: won ? attempts : 0 });

  if (!error) {
    localStorage.setItem(getSubmittedKey(date), "1");
  }
}

export interface LeaderboardEntry {
  attempts: number;
  count: number;
}

export async function getDailyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("daily_results")
    .select("attempts")
    .eq("date", date);

  if (error || !data) return [];

  // Aggregate client-side (Supabase JS doesn't support GROUP BY)
  const counts = new Map<number, number>();
  for (const row of data) {
    counts.set(row.attempts, (counts.get(row.attempts) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([attempts, count]) => ({ attempts, count }))
    .sort((a, b) => a.attempts - b.attempts);
}
