import { supabase } from "./supabaseClient";

const LB_SUBMITTED_PREFIX = "football-nerdle-lb-";

function getSubmittedKey(date: string): string {
  return LB_SUBMITTED_PREFIX + date;
}

export function hasSubmittedResult(date: string): boolean {
  return localStorage.getItem(getSubmittedKey(date)) === "1";
}

export async function submitDailyResult(date: string, won: boolean, attempts: number): Promise<void> {
  // Local dev runs against production data; never pollute the live leaderboard.
  if (import.meta.env.DEV) return;
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

/**
 * Normalise rows returned by the `get_daily_leaderboard` RPC: coerce numeric
 * fields (counts may arrive as strings/bigint-like values), drop malformed or
 * empty rows, and sort by attempts ascending.
 */
export function toLeaderboardEntries(rows: unknown[] | null): LeaderboardEntry[] {
  if (!rows) return [];
  const entries: LeaderboardEntry[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const attempts = Number(r.attempts);
    const count = Number(r.count);
    if (!Number.isFinite(attempts) || !Number.isFinite(count) || count <= 0) continue;
    entries.push({ attempts, count });
  }
  return entries.sort((a, b) => a.attempts - b.attempts);
}

export async function getDailyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("get_daily_leaderboard", { p_date: date });

  if (error || !data) return [];

  return toLeaderboardEntries(data as unknown[]);
}
