import { SEED_PLAYERS } from "../../data/seedPlayers";
import { DAILY_GUESS_KEY, DAILY_RESULT_PREFIX, DAY_ONE_DATE, STATS_KEY } from "./constants";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
import type { DailyResult, GuessStats } from "./types";
import type { FormerTeam } from "../../types";
import type { MergedClub } from "../../components/PlayerCard/types";
import { getBaseClubName } from "../../utils/clubNames";

import { getTodayString } from "../../utils/dates";
export { getTodayString };

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

export function mergeConsecutiveClubs(clubs: FormerTeam[]): MergedClub[] {
  const merged: MergedClub[] = [];
  for (const club of clubs) {
    const baseName = getBaseClubName(club.teamName);
    const last = merged[merged.length - 1];
    if (last && getBaseClubName(last.teamName) === baseName) {
      last.stints.push(club);
      if (!last.yearJoined || (club.yearJoined && club.yearJoined < last.yearJoined)) {
        last.yearJoined = club.yearJoined;
      }
      if (!club.yearDeparted || (club.yearDeparted && (!last.yearDeparted || club.yearDeparted > last.yearDeparted))) {
        last.yearDeparted = club.yearDeparted;
      }
      if (!last.badge && club.badge) last.badge = club.badge;
    } else {
      merged.push({
        teamId: club.teamId,
        teamName: club.teamName,
        yearJoined: club.yearJoined,
        yearDeparted: club.yearDeparted,
        badge: club.badge,
        isLoan: club.isLoan,
        stints: [club],
      });
    }
  }
  for (const m of merged) {
    if (m.stints.length > 1) {
      m.teamName = getBaseClubName(m.stints[0].teamName);
    }
  }
  return merged;
}

const DEFAULT_STATS: GuessStats = { played: 0, won: 0, lost: 0, streak: 0, longestStreak: 0 };

function daysBetween(from: string, to: string): number {
  const toUTC = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUTC(to) - toUTC(from)) / 86_400_000);
}

// Legacy stats (pre-fix) have no lastPlayedDate. Recover it by scanning the
// per-date daily result keys for the most recent play — so existing users
// get correct gap detection on their first post-deploy play.
function inferLastPlayedDate(): string | undefined {
  let latest: string | undefined;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(DAILY_RESULT_PREFIX)) continue;
      const date = key.slice(DAILY_RESULT_PREFIX.length);
      if (!ISO_DATE.test(date)) continue;
      if (!latest || date > latest) latest = date;
    }
    if (!latest) {
      const legacy = localStorage.getItem(DAILY_GUESS_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (typeof parsed?.date === "string" && ISO_DATE.test(parsed.date)) {
          latest = parsed.date;
        }
      }
    }
  } catch {
    // fall through
  }
  return latest;
}

export function loadStats(today: string = getTodayString()): GuessStats {
  try {
    const stored = localStorage.getItem(STATS_KEY);
    const stats: GuessStats = stored
      ? { ...DEFAULT_STATS, ...JSON.parse(stored) }
      : { ...DEFAULT_STATS };
    if (!stats.lastPlayedDate && stats.played > 0) {
      stats.lastPlayedDate = inferLastPlayedDate();
    }
    if (stats.streak > 0 && stats.lastPlayedDate && daysBetween(stats.lastPlayedDate, today) > 1) {
      stats.streak = 0;
    }
    return stats;
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function recordResult(won: boolean, today: string = getTodayString()): GuessStats {
  const stats = loadStats(today);
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
  stats.lastPlayedDate = today;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  return stats;
}
