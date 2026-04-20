import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadStats, recordResult } from "../pages/GuessThePlayer/helpers";
import { DAILY_GUESS_KEY, DAILY_RESULT_PREFIX, STATS_KEY } from "../pages/GuessThePlayer/constants";

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

describe("recordResult — streak with date gaps", () => {
  beforeEach(() => {
    installLocalStorageShim();
  });

  it("increments streak on consecutive daily wins", () => {
    recordResult(true, "2026-04-15");
    recordResult(true, "2026-04-16");
    const stats = recordResult(true, "2026-04-17");
    expect(stats.streak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });

  it("resets streak to 1 after a skipped day, then win", () => {
    recordResult(true, "2026-04-15");
    recordResult(true, "2026-04-16");
    // skip 2026-04-17, play 2026-04-18
    const stats = recordResult(true, "2026-04-18");
    expect(stats.streak).toBe(1);
  });

  it("preserves longestStreak across a broken streak", () => {
    recordResult(true, "2026-04-15");
    recordResult(true, "2026-04-16");
    recordResult(true, "2026-04-17"); // streak=3
    // skip 2 days
    const stats = recordResult(true, "2026-04-20");
    expect(stats.streak).toBe(1);
    expect(stats.longestStreak).toBe(3);
  });

  it("resets streak to 0 on a loss", () => {
    recordResult(true, "2026-04-15");
    recordResult(true, "2026-04-16");
    const stats = recordResult(false, "2026-04-17");
    expect(stats.streak).toBe(0);
  });

  it("first play ever yields streak=1 on win", () => {
    const stats = recordResult(true, "2026-04-15");
    expect(stats.streak).toBe(1);
    expect(stats.longestStreak).toBe(1);
  });

  it("records lastPlayedDate on each play", () => {
    recordResult(true, "2026-04-15");
    const stats = recordResult(false, "2026-04-16");
    expect(stats.lastPlayedDate).toBe("2026-04-16");
  });
});

describe("loadStats — display-time stale streak", () => {
  beforeEach(() => {
    installLocalStorageShim();
  });

  it("shows streak as 0 when last played date is more than 1 day ago", () => {
    recordResult(true, "2026-04-15");
    recordResult(true, "2026-04-16"); // streak=2, last=2026-04-16
    // user opens the app on 2026-04-20 without playing
    const stats = loadStats("2026-04-20");
    expect(stats.streak).toBe(0);
    expect(stats.longestStreak).toBe(2);
  });

  it("keeps streak intact when viewed on the same day", () => {
    recordResult(true, "2026-04-15");
    recordResult(true, "2026-04-16");
    const stats = loadStats("2026-04-16");
    expect(stats.streak).toBe(2);
  });

  it("keeps streak intact when viewed the day after last play", () => {
    recordResult(true, "2026-04-15");
    recordResult(true, "2026-04-16");
    const stats = loadStats("2026-04-17");
    expect(stats.streak).toBe(2);
  });

  it("returns defaults when no stats stored", () => {
    const stats = loadStats("2026-04-20");
    expect(stats.played).toBe(0);
    expect(stats.streak).toBe(0);
    expect(stats.longestStreak).toBe(0);
  });

  it("keeps legacy stats intact when no per-date results exist to infer from", () => {
    localStorage.setItem(
      STATS_KEY,
      JSON.stringify({ played: 5, won: 4, lost: 1, streak: 4, longestStreak: 4 })
    );
    const stats = loadStats("2026-04-20");
    expect(stats.streak).toBe(4);
    expect(stats.longestStreak).toBe(4);
  });
});

describe("loadStats — legacy backfill of lastPlayedDate", () => {
  beforeEach(() => {
    installLocalStorageShim();
  });

  it("infers lastPlayedDate from per-date result keys and breaks stale streak", () => {
    localStorage.setItem(
      STATS_KEY,
      JSON.stringify({ played: 5, won: 5, lost: 0, streak: 5, longestStreak: 5 })
    );
    localStorage.setItem(
      DAILY_RESULT_PREFIX + "2026-04-15",
      JSON.stringify({ date: "2026-04-15", status: "won", attempts: 3 })
    );
    localStorage.setItem(
      DAILY_RESULT_PREFIX + "2026-04-17",
      JSON.stringify({ date: "2026-04-17", status: "won", attempts: 2 })
    );
    const stats = loadStats("2026-04-20");
    expect(stats.streak).toBe(0);
    expect(stats.longestStreak).toBe(5);
  });

  it("keeps streak intact when inferred lastPlayedDate is within 1 day", () => {
    localStorage.setItem(
      STATS_KEY,
      JSON.stringify({ played: 5, won: 5, lost: 0, streak: 5, longestStreak: 5 })
    );
    localStorage.setItem(
      DAILY_RESULT_PREFIX + "2026-04-19",
      JSON.stringify({ date: "2026-04-19", status: "won", attempts: 3 })
    );
    const stats = loadStats("2026-04-20");
    expect(stats.streak).toBe(5);
  });

  it("falls back to legacy single daily key when no per-date results exist", () => {
    localStorage.setItem(
      STATS_KEY,
      JSON.stringify({ played: 3, won: 3, lost: 0, streak: 3, longestStreak: 3 })
    );
    localStorage.setItem(
      DAILY_GUESS_KEY,
      JSON.stringify({ date: "2026-04-10", status: "won", attempts: 2 })
    );
    const stats = loadStats("2026-04-20");
    expect(stats.streak).toBe(0);
    expect(stats.longestStreak).toBe(3);
  });

  it("persists inferred lastPlayedDate on next recordResult", () => {
    localStorage.setItem(
      STATS_KEY,
      JSON.stringify({ played: 5, won: 5, lost: 0, streak: 5, longestStreak: 5 })
    );
    localStorage.setItem(
      DAILY_RESULT_PREFIX + "2026-04-15",
      JSON.stringify({ date: "2026-04-15", status: "won", attempts: 3 })
    );
    const stats = recordResult(true, "2026-04-20");
    // streak reset by gap, then win → 1
    expect(stats.streak).toBe(1);
    expect(stats.lastPlayedDate).toBe("2026-04-20");
    expect(stats.longestStreak).toBe(5);
  });

  it("does not infer when played is 0", () => {
    // Fresh user, no stats → no scan, no noise
    localStorage.setItem(
      DAILY_RESULT_PREFIX + "2026-04-15",
      JSON.stringify({ date: "2026-04-15", status: "won", attempts: 3 })
    );
    const stats = loadStats("2026-04-20");
    expect(stats.lastPlayedDate).toBeUndefined();
    expect(stats.streak).toBe(0);
  });
});
