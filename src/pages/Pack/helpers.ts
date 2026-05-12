import { PACK_DAY_ONE_DATE, PACK_RESULT_PREFIX, PACK_SHARE_URL } from "./constants";
import type { PackAttempt } from "./types";

const MS_PER_DAY = 86_400_000;

export function getPackDayNumber(date: string): number {
  const start = new Date(`${PACK_DAY_ONE_DATE}T00:00:00Z`);
  const current = new Date(`${date}T00:00:00Z`);
  return Math.floor((current.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

export function getDateForPackDay(day: number): string {
  const start = new Date(`${PACK_DAY_ONE_DATE}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + (day - 1));
  return start.toISOString().slice(0, 10);
}

export interface SavedPackResult {
  date: string;
  score: number;
  attempts: PackAttempt[];
}

export function savePackResult(result: SavedPackResult): void {
  try {
    localStorage.setItem(PACK_RESULT_PREFIX + result.date, JSON.stringify(result));
  } catch {
    // ignore quota errors
  }
}

export function loadPackResult(date: string): SavedPackResult | null {
  try {
    const raw = localStorage.getItem(PACK_RESULT_PREFIX + date);
    if (!raw) return null;
    return JSON.parse(raw) as SavedPackResult;
  } catch {
    return null;
  }
}

export interface ShareInput {
  date: string;
  clubName: string;
  score: number;
  attempts: PackAttempt[];
}

export function buildShareText({ date, clubName, score, attempts }: ShareInput): string {
  const dayNum = getPackDayNumber(date);
  const grid = attempts.map((a) => (a.correct ? "✅" : "❌")).join("");
  return `Football Nerdle Pack #${dayNum} — ${clubName} ${score}/${attempts.length}\n${grid}\n${PACK_SHARE_URL}`;
}
