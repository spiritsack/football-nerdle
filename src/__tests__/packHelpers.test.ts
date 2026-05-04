import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getPackDayNumber,
  getDateForPackDay,
  buildShareText,
  savePackResult,
  loadPackResult,
} from "../pages/Pack/helpers";
import type { PackAttempt } from "../pages/Pack/types";

function installLocalStorageShim() {
  const store = new Map<string, string>();
  const shim = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  vi.stubGlobal("localStorage", shim);
}

describe("getPackDayNumber", () => {
  it("returns 1 for the launch date", () => {
    expect(getPackDayNumber("2026-05-04")).toBe(1);
  });

  it("returns 2 for the day after launch", () => {
    expect(getPackDayNumber("2026-05-05")).toBe(2);
  });

  it("is independent of the Guess the Player day numbering", () => {
    // Same date should not produce the GuessThePlayer day-number anchored to 2026-03-24
    const packDay = getPackDayNumber("2026-05-04");
    expect(packDay).toBe(1);
  });
});

describe("getDateForPackDay", () => {
  it("is the inverse of getPackDayNumber", () => {
    for (let day = 1; day <= 30; day++) {
      expect(getPackDayNumber(getDateForPackDay(day))).toBe(day);
    }
  });
});

function attempts(pattern: boolean[]): PackAttempt[] {
  return pattern.map((correct, i) => ({ playerId: `p${i + 1}`, correct, guesses: correct ? 1 : 3 }));
}

describe("buildShareText", () => {
  it("includes pack day number, club name, score, and emoji grid", () => {
    const text = buildShareText({
      date: "2026-05-04",
      clubName: "Liverpool",
      score: 7,
      attempts: attempts([true, true, false, true, true, true, false, true, true, false]),
    });
    expect(text).toContain("Pack #1");
    expect(text).toContain("Liverpool");
    expect(text).toContain("7/10");
    expect(text).toContain("✅✅❌✅✅✅❌✅✅❌");
  });

  it("includes the share URL", () => {
    const text = buildShareText({
      date: "2026-05-04",
      clubName: "Liverpool",
      score: 0,
      attempts: attempts(Array(10).fill(false)),
    });
    expect(text).toContain("https://spiritsack.github.io/football-nerdle/#/pack");
  });
});

describe("pack result localStorage", () => {
  beforeEach(() => {
    installLocalStorageShim();
  });

  it("round-trips a saved result", () => {
    const a = attempts([true, false, true, false, true, false, true, false, true, false]);
    savePackResult({ date: "2026-05-04", score: 5, attempts: a });
    expect(loadPackResult("2026-05-04")).toEqual({ date: "2026-05-04", score: 5, attempts: a });
  });

  it("returns null when nothing is saved for that date", () => {
    expect(loadPackResult("2026-05-04")).toBeNull();
  });

  it("uses a date-scoped key separate from the daily-guess key", () => {
    savePackResult({ date: "2026-05-04", score: 5, attempts: [] });
    expect(localStorage.getItem("football-nerdle-pack-2026-05-04")).not.toBeNull();
    expect(localStorage.getItem("football-nerdle-daily-2026-05-04")).toBeNull();
  });
});
