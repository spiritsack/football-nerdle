import { describe, it, expect, beforeEach, vi } from "vitest";
import { recordPackResult, loadPackStats, DEFAULT_PACK_STATS } from "../pages/Pack/stats";

function installLocalStorageShim() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  });
}

const NEVER_MET = () => false;
const ALWAYS_MET = () => true;

describe("recordPackResult — first-ever play", () => {
  beforeEach(installLocalStorageShim);

  it("score >= threshold yields streak 1, longestStreak 1, played 1, lastSuccessDate=today", () => {
    const stats = recordPackResult(DEFAULT_PACK_STATS, "2026-05-04", 7, [], NEVER_MET);
    expect(stats.played).toBe(1);
    expect(stats.totalScore).toBe(7);
    expect(stats.bestScore).toBe(7);
    expect(stats.streak).toBe(1);
    expect(stats.longestStreak).toBe(1);
    expect(stats.lastPlayedDate).toBe("2026-05-04");
    expect(stats.lastSuccessDate).toBe("2026-05-04");
  });

  it("score below threshold yields streak 0 and no lastSuccessDate", () => {
    const stats = recordPackResult(DEFAULT_PACK_STATS, "2026-05-04", 6, [], NEVER_MET);
    expect(stats.streak).toBe(0);
    expect(stats.longestStreak).toBe(0);
    expect(stats.lastSuccessDate).toBeUndefined();
    expect(stats.lastPlayedDate).toBe("2026-05-04");
  });
});

describe("recordPackResult — streak advance and break", () => {
  beforeEach(installLocalStorageShim);

  it("advances on a passing score the day after the previous success (no gap)", () => {
    const day1 = recordPackResult(DEFAULT_PACK_STATS, "2026-05-04", 8, [], NEVER_MET);
    const day2 = recordPackResult(day1, "2026-05-05", 9, [], NEVER_MET);
    expect(day2.streak).toBe(2);
    expect(day2.longestStreak).toBe(2);
  });

  it("survives a calendar gap on dates that had no pack scheduled", () => {
    const day1 = recordPackResult(DEFAULT_PACK_STATS, "2026-05-04", 8, [], NEVER_MET);
    // No pack on 2026-05-05; user plays again on 2026-05-06.
    const day3 = recordPackResult(day1, "2026-05-06", 7, [], ALWAYS_MET);
    expect(day3.streak).toBe(2);
  });

  it("breaks when a scheduled day between last success and today was missed", () => {
    const day1 = recordPackResult(DEFAULT_PACK_STATS, "2026-05-04", 8, [], NEVER_MET);
    // Pack scheduled on 2026-05-05 — user did not play it.
    const day3 = recordPackResult(day1, "2026-05-06", 8, ["2026-05-05"], NEVER_MET);
    expect(day3.streak).toBe(1);
    expect(day3.longestStreak).toBe(1);
  });

  it("survives when scheduled in-between days were played at threshold but stats weren't updated for them", () => {
    const day1 = recordPackResult(DEFAULT_PACK_STATS, "2026-05-04", 8, [], NEVER_MET);
    // Pack scheduled on 2026-05-05 and the user did meet the threshold there
    // (according to the per-day result store), even though stats weren't recorded.
    const day3 = recordPackResult(day1, "2026-05-06", 8, ["2026-05-05"], (d) => d === "2026-05-05");
    expect(day3.streak).toBe(2);
  });

  it("a sub-threshold score breaks the streak even when prior days were perfect", () => {
    const day1 = recordPackResult(DEFAULT_PACK_STATS, "2026-05-04", 10, [], NEVER_MET);
    const day2 = recordPackResult(day1, "2026-05-05", 5, [], NEVER_MET);
    expect(day2.streak).toBe(0);
    expect(day2.longestStreak).toBe(1);
  });
});

describe("loadPackStats", () => {
  beforeEach(installLocalStorageShim);

  it("returns defaults when nothing is stored", () => {
    expect(loadPackStats()).toEqual(DEFAULT_PACK_STATS);
  });

  it("round-trips through recordPackResult", () => {
    recordPackResult(DEFAULT_PACK_STATS, "2026-05-04", 9, [], NEVER_MET);
    const reloaded = loadPackStats();
    expect(reloaded.played).toBe(1);
    expect(reloaded.bestScore).toBe(9);
    expect(reloaded.streak).toBe(1);
  });
});