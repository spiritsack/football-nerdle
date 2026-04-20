import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadStats, recordResult } from "../pages/GuessThePlayer/helpers";
import { STATS_KEY } from "../pages/GuessThePlayer/constants";

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

  it("preserves legacy stats without lastPlayedDate", () => {
    // Simulate a pre-fix stats blob with no lastPlayedDate
    localStorage.setItem(
      STATS_KEY,
      JSON.stringify({ played: 5, won: 4, lost: 1, streak: 4, longestStreak: 4 })
    );
    const stats = loadStats("2026-04-20");
    // No lastPlayedDate means we can't detect a gap — show as-is
    expect(stats.streak).toBe(4);
    expect(stats.longestStreak).toBe(4);
  });
});
