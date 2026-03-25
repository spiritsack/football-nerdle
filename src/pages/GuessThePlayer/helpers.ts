import { SEED_PLAYERS } from "../../data/seedPlayers";
import { DAILY_GUESS_KEY, DAY_ONE_DATE } from "./constants";
import type { DailyResult } from "./types";

export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDailyPlayerIndex(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % SEED_PLAYERS.length;
}

export function getDayNumber(dateStr: string): number {
  const start = new Date(DAY_ONE_DATE);
  const current = new Date(dateStr);
  return Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function getDailyResult(): DailyResult | null {
  const stored = localStorage.getItem(DAILY_GUESS_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function saveDailyResult(status: "won" | "lost", attempts: number) {
  localStorage.setItem(
    DAILY_GUESS_KEY,
    JSON.stringify({ date: getTodayString(), status, attempts })
  );
}
