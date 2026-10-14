import {
  DAILY_GUESS_KEY,
  DAILY_RESULT_PREFIX,
  MAX_ATTEMPTS,
} from "../GuessThePlayer/constants";
import { loadStats } from "../GuessThePlayer/helpers";
import type { DailyResult } from "../GuessThePlayer/types";
import type { DailySummaryParts, HomeDailyState } from "./types";

function parseResult(raw: string | null, today: string): DailyResult | null {
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const { status, attempts } = parsed as Record<string, unknown>;
  if (status !== "won" && status !== "lost") return null;
  if (
    typeof attempts !== "number" ||
    !Number.isInteger(attempts) ||
    attempts < 1 ||
    attempts > MAX_ATTEMPTS
  ) {
    return null;
  }
  return { date: today, status, attempts };
}

function readLegacyForToday(today: string): string | null {
  const legacy = localStorage.getItem(DAILY_GUESS_KEY);
  if (!legacy) return null;
  const parsed: unknown = JSON.parse(legacy);
  if (parsed && typeof parsed === "object" && (parsed as { date?: unknown }).date === today) {
    return legacy;
  }
  return null;
}

/**
 * Read today's daily result without writing anything to localStorage.
 * Prefers the per-date key, falling back to the legacy single key when it is
 * for today. Returns null for missing, malformed or invalid data.
 */
export function readTodayDailyResult(today: string): DailyResult | null {
  try {
    const perDate = localStorage.getItem(DAILY_RESULT_PREFIX + today);
    if (perDate) return parseResult(perDate, today);
    return parseResult(readLegacyForToday(today), today);
  } catch {
    return null;
  }
}

/**
 * Whether today's daily has been played, regardless of whether the stored
 * entry has a valid status (drives the "Daily (Done)" button state).
 */
export function getDailyDone(today: string): boolean {
  try {
    if (localStorage.getItem(DAILY_RESULT_PREFIX + today)) return true;
  } catch {
    // fall through to legacy key
  }
  try {
    return readLegacyForToday(today) !== null;
  } catch {
    return false;
  }
}

export function getDailySummaryParts(
  result: DailyResult | null,
  streak: number,
): DailySummaryParts | null {
  if (!result) return null;
  if (result.status === "lost") return { won: false, headline: "Missed today", streak: null };
  return {
    won: true,
    headline: `Solved in ${result.attempts}/${MAX_ATTEMPTS}`,
    streak: streak >= 1 ? streak : null,
  };
}

export function formatDailySummary(result: DailyResult | null, streak: number): string | null {
  const parts = getDailySummaryParts(result, streak);
  if (!parts) return null;
  return parts.streak === null
    ? parts.headline
    : `${parts.headline} · 🔥 ${parts.streak}-day streak`;
}

/**
 * Everything the Guess the Player card needs, read once from localStorage.
 * The streak comes from loadStats(today), which zeroes a stale streak.
 */
export function readHomeDailyState(today: string): HomeDailyState {
  const result = readTodayDailyResult(today);
  const streak = result ? loadStats(today).streak : 0;
  return {
    dailyDone: getDailyDone(today),
    summary: getDailySummaryParts(result, streak),
  };
}
