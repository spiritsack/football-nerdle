import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  formatDailySummary,
  getDailyDone,
  readHomeDailyState,
  readTodayDailyResult,
} from "../pages/Home/helpers";
import { DAILY_GUESS_KEY, DAILY_RESULT_PREFIX, STATS_KEY } from "../pages/GuessThePlayer/constants";

const TODAY = "2026-04-20";

function installLocalStorageShim() {
  const store = new Map<string, string>();
  const shim = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: vi.fn((k: string, v: string) => void store.set(k, v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  vi.stubGlobal("localStorage", shim);
  return { store, shim };
}

describe("formatDailySummary", () => {
  it("win with streak", () => {
    expect(formatDailySummary({ date: TODAY, status: "won", attempts: 3 }, 4)).toBe(
      "Solved in 3/5 · 🔥 4-day streak",
    );
    expect(formatDailySummary({ date: TODAY, status: "won", attempts: 1 }, 1)).toBe(
      "Solved in 1/5 · 🔥 1-day streak",
    );
  });

  it("win without streak", () => {
    expect(formatDailySummary({ date: TODAY, status: "won", attempts: 2 }, 0)).toBe("Solved in 2/5");
  });

  it("loss", () => {
    expect(formatDailySummary({ date: TODAY, status: "lost", attempts: 5 }, 0)).toBe("Missed today");
    // Never shows a streak after a loss, even if one is passed in
    expect(formatDailySummary({ date: TODAY, status: "lost", attempts: 5 }, 3)).toBe("Missed today");
  });

  it("no result", () => {
    expect(formatDailySummary(null, 4)).toBeNull();
  });
});

describe("readTodayDailyResult", () => {
  let store: Map<string, string>;
  let shim: ReturnType<typeof installLocalStorageShim>["shim"];

  beforeEach(() => {
    ({ store, shim } = installLocalStorageShim());
  });

  it("reads the per-date key for today", () => {
    store.set(DAILY_RESULT_PREFIX + TODAY, JSON.stringify({ date: TODAY, status: "won", attempts: 3 }));
    expect(readTodayDailyResult(TODAY)).toEqual({ date: TODAY, status: "won", attempts: 3 });
  });

  it("prefers the per-date key over the legacy key", () => {
    store.set(DAILY_RESULT_PREFIX + TODAY, JSON.stringify({ date: TODAY, status: "lost", attempts: 5 }));
    store.set(DAILY_GUESS_KEY, JSON.stringify({ date: TODAY, status: "won", attempts: 2 }));
    expect(readTodayDailyResult(TODAY)?.status).toBe("lost");
  });

  it("returns null for other dates", () => {
    expect(readTodayDailyResult(TODAY)).toBeNull();
    store.set(DAILY_RESULT_PREFIX + "2026-04-19", JSON.stringify({ date: "2026-04-19", status: "won", attempts: 2 }));
    store.set(DAILY_GUESS_KEY, JSON.stringify({ date: "2026-04-19", status: "won", attempts: 2 }));
    expect(readTodayDailyResult(TODAY)).toBeNull();
  });

  it("rejects malformed data", () => {
    const key = DAILY_RESULT_PREFIX + TODAY;
    const bad = [
      "{not json",
      "null",
      "42",
      JSON.stringify({ date: TODAY }),
      JSON.stringify({ date: TODAY, status: "playing", attempts: 3 }),
      JSON.stringify({ date: TODAY, status: "won", attempts: 0 }),
      JSON.stringify({ date: TODAY, status: "won", attempts: 6 }),
      JSON.stringify({ date: TODAY, status: "won", attempts: 2.5 }),
      JSON.stringify({ date: TODAY, status: "won", attempts: "3" }),
    ];
    for (const value of bad) {
      store.set(key, value);
      expect(readTodayDailyResult(TODAY)).toBeNull();
    }
    store.delete(key);
    store.set(DAILY_GUESS_KEY, "{not json");
    expect(readTodayDailyResult(TODAY)).toBeNull();
  });

  it("returns null when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });
    expect(readTodayDailyResult(TODAY)).toBeNull();
    expect(getDailyDone(TODAY)).toBe(false);
  });

  it("uses a legacy-only result for today without writing to localStorage", () => {
    store.set(DAILY_GUESS_KEY, JSON.stringify({ date: TODAY, status: "won", attempts: 4 }));
    expect(readTodayDailyResult(TODAY)).toEqual({ date: TODAY, status: "won", attempts: 4 });
    expect(getDailyDone(TODAY)).toBe(true);
    readHomeDailyState(TODAY);
    expect(shim.setItem).not.toHaveBeenCalled();
    expect(store.has(DAILY_RESULT_PREFIX + TODAY)).toBe(false);
  });
});

describe("getDailyDone", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    ({ store } = installLocalStorageShim());
  });

  it("is false with nothing stored", () => {
    expect(getDailyDone(TODAY)).toBe(false);
  });

  it("is true for a status-less legacy entry for today", () => {
    store.set(DAILY_GUESS_KEY, JSON.stringify({ date: TODAY }));
    expect(getDailyDone(TODAY)).toBe(true);
  });

  it("is true for any per-date entry for today", () => {
    store.set(DAILY_RESULT_PREFIX + TODAY, "{not json");
    expect(getDailyDone(TODAY)).toBe(true);
  });

  it("is false for a legacy entry from another day", () => {
    store.set(DAILY_GUESS_KEY, JSON.stringify({ date: "2026-04-19" }));
    expect(getDailyDone(TODAY)).toBe(false);
  });
});

describe("readHomeDailyState", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    ({ store } = installLocalStorageShim());
  });

  it("shows the stored streak after a win today", () => {
    store.set(DAILY_RESULT_PREFIX + TODAY, JSON.stringify({ date: TODAY, status: "won", attempts: 3 }));
    store.set(STATS_KEY, JSON.stringify({ played: 4, won: 4, lost: 0, streak: 4, longestStreak: 4, lastPlayedDate: TODAY }));
    const state = readHomeDailyState(TODAY);
    expect(state.dailyDone).toBe(true);
    expect(state.summary).toEqual({ won: true, headline: "Solved in 3/5", streak: 4 });
  });

  it("drops a stale streak via loadStats", () => {
    store.set(DAILY_RESULT_PREFIX + TODAY, JSON.stringify({ date: TODAY, status: "won", attempts: 2 }));
    store.set(STATS_KEY, JSON.stringify({ played: 7, won: 7, lost: 0, streak: 7, longestStreak: 7, lastPlayedDate: "2026-04-15" }));
    expect(readHomeDailyState(TODAY).summary).toEqual({ won: true, headline: "Solved in 2/5", streak: null });
  });

  it("shows no streak when the stats key is missing", () => {
    store.set(DAILY_RESULT_PREFIX + TODAY, JSON.stringify({ date: TODAY, status: "won", attempts: 5 }));
    expect(readHomeDailyState(TODAY).summary).toEqual({ won: true, headline: "Solved in 5/5", streak: null });
  });

  it("has no summary but is done for a status-less legacy entry", () => {
    store.set(DAILY_GUESS_KEY, JSON.stringify({ date: TODAY }));
    expect(readHomeDailyState(TODAY)).toEqual({ dailyDone: true, summary: null });
  });

  it("has no summary and is not done when nothing is stored", () => {
    expect(readHomeDailyState(TODAY)).toEqual({ dailyDone: false, summary: null });
  });
});
