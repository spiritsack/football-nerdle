import { SEED_PLAYERS } from "../../data/seedPlayers";
import { DAILY_GUESS_KEY, DAILY_RESULT_PREFIX, DAY_ONE_DATE, STATS_KEY } from "./constants";
import type { DailyResult, GuessStats } from "./types";

export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Fallback daily player selection used when Supabase is unavailable.
// Sequential day-number indexing: day 1 = index 0, day 2 = index 1, etc.
// Wraps around after all seed players are exhausted.
export function getDailyPlayerIndex(dateStr: string): number {
  const dayNum = getDayNumber(dateStr);
  return (dayNum - 1) % SEED_PLAYERS.length;
}

export function getDayNumber(dateStr: string): number {
  const start = new Date(DAY_ONE_DATE);
  const current = new Date(dateStr);
  return Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function getDateForDay(dayNum: number): string {
  const start = new Date(DAY_ONE_DATE + "T12:00:00Z");
  start.setUTCDate(start.getUTCDate() + (dayNum - 1));
  return start.toISOString().split("T")[0];
}

// Per-date result storage (replaces single DAILY_GUESS_KEY)
export function getDailyResultForDate(date: string): DailyResult | null {
  try {
    const stored = localStorage.getItem(DAILY_RESULT_PREFIX + date);
    if (stored) return JSON.parse(stored);

    // Migrate old single-key format if it matches today
    const legacy = localStorage.getItem(DAILY_GUESS_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed.date === date) {
        localStorage.setItem(DAILY_RESULT_PREFIX + date, legacy);
        return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function getDailyResult(): DailyResult | null {
  return getDailyResultForDate(getTodayString());
}

export function saveDailyResultForDate(date: string, status: "won" | "lost", attempts: number) {
  const result = { date, status, attempts };
  localStorage.setItem(DAILY_RESULT_PREFIX + date, JSON.stringify(result));
  // Keep legacy key in sync for today (backwards compat)
  if (date === getTodayString()) {
    localStorage.setItem(DAILY_GUESS_KEY, JSON.stringify(result));
  }
}

export function saveDailyResult(status: "won" | "lost", attempts: number) {
  saveDailyResultForDate(getTodayString(), status, attempts);
}

const DEFAULT_STATS: GuessStats = { played: 0, won: 0, lost: 0, streak: 0, longestStreak: 0 };

export function loadStats(): GuessStats {
  try {
    const stored = localStorage.getItem(STATS_KEY);
    if (!stored) return { ...DEFAULT_STATS };
    return { ...DEFAULT_STATS, ...JSON.parse(stored) };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function recordResult(won: boolean): GuessStats {
  const stats = loadStats();
  stats.played++;
  if (won) {
    stats.won++;
    stats.streak++;
    if (stats.streak > stats.longestStreak) {
      stats.longestStreak = stats.streak;
    }
  } else {
    stats.lost++;
    stats.streak = 0;
  }
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  return stats;
}
