import { PACK_STATS_KEY, PACK_STREAK_THRESHOLD } from "./constants";

export interface PackStats {
  played: number;
  totalScore: number;
  bestScore: number;
  streak: number;
  longestStreak: number;
  lastPlayedDate?: string;
  lastSuccessDate?: string;
}

export const DEFAULT_PACK_STATS: PackStats = {
  played: 0,
  totalScore: 0,
  bestScore: 0,
  streak: 0,
  longestStreak: 0,
};

export function loadPackStats(): PackStats {
  try {
    const raw = localStorage.getItem(PACK_STATS_KEY);
    if (!raw) return { ...DEFAULT_PACK_STATS };
    return { ...DEFAULT_PACK_STATS, ...(JSON.parse(raw) as Partial<PackStats>) };
  } catch {
    return { ...DEFAULT_PACK_STATS };
  }
}

function savePackStats(stats: PackStats): void {
  try {
    localStorage.setItem(PACK_STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

export function recordPackResult(
  prev: PackStats,
  date: string,
  score: number,
  scheduledBetween: string[],
  metThresholdAt: (date: string) => boolean,
): PackStats {
  const passed = score >= PACK_STREAK_THRESHOLD;
  let nextStreak = 0;
  if (passed) {
    const noBrokenScheduledGap = scheduledBetween.every((d) => metThresholdAt(d));
    nextStreak = noBrokenScheduledGap ? prev.streak + 1 : 1;
  }
  const next: PackStats = {
    played: prev.played + 1,
    totalScore: prev.totalScore + score,
    bestScore: Math.max(prev.bestScore, score),
    streak: nextStreak,
    longestStreak: Math.max(prev.longestStreak, nextStreak),
    lastPlayedDate: date,
    lastSuccessDate: passed ? date : prev.lastSuccessDate,
  };
  savePackStats(next);
  return next;
}
