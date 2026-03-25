import { BEST_STREAK_KEY } from "./constants";

export function loadBestStreak(): number {
  const stored = localStorage.getItem(BEST_STREAK_KEY);
  return stored ? parseInt(stored, 10) || 0 : 0;
}

export function saveBestStreak(score: number, current: number, setBestStreak: (n: number) => void) {
  if (score > current) {
    localStorage.setItem(BEST_STREAK_KEY, String(score));
    setBestStreak(score);
  }
}
