import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadDistribution, recordResult, recordWin } from "../pages/GuessThePlayer/helpers";
import { DAILY_RESULT_PREFIX, GUESS_DISTRIBUTION_KEY, STATS_KEY } from "../pages/GuessThePlayer/constants";

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

const EMPTY = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

describe("guess distribution", () => {
  beforeEach(() => {
    installLocalStorageShim();
  });

  it("key does not use the per-date daily result prefix", () => {
    expect(GUESS_DISTRIBUTION_KEY.startsWith(DAILY_RESULT_PREFIX)).toBe(false);
  });

  describe("loadDistribution", () => {
    it("returns all zeros when the key is missing", () => {
      expect(loadDistribution()).toEqual(EMPTY);
    });

    it("returns all zeros for invalid JSON", () => {
      localStorage.setItem(GUESS_DISTRIBUTION_KEY, "{not json");
      expect(loadDistribution()).toEqual(EMPTY);
    });

    it.each([["null"], ["42"], ['"text"'], ["[1,2,3]"], ["true"]])(
      "returns all zeros for non-object value %s",
      (raw) => {
        localStorage.setItem(GUESS_DISTRIBUTION_KEY, raw);
        expect(loadDistribution()).toEqual(EMPTY);
      },
    );

    it("reads a valid stored distribution", () => {
      localStorage.setItem(GUESS_DISTRIBUTION_KEY, JSON.stringify({ 1: 1, 2: 0, 3: 4, 4: 0, 5: 2 }));
      expect(loadDistribution()).toEqual({ 1: 1, 2: 0, 3: 4, 4: 0, 5: 2 });
    });

    it("zeroes invalid bucket values and drops extra keys", () => {
      localStorage.setItem(
        GUESS_DISTRIBUTION_KEY,
        // NaN/Infinity cannot be expressed in JSON; null is what JSON.stringify(NaN) gives
        '{"1":-3,"2":"4","3":null,"4":7,"5":{},"0":9,"6":5,"foo":1}',
      );
      const dist = loadDistribution();
      expect(dist).toEqual({ 1: 0, 2: 0, 3: 0, 4: 7, 5: 0 });
      expect(Object.keys(dist).sort()).toEqual(["1", "2", "3", "4", "5"]);
    });

    it("zeroes NaN and Infinity buckets", () => {
      vi.spyOn(JSON, "parse").mockImplementationOnce(() => ({ 1: NaN, 2: Infinity, 3: 2 }));
      localStorage.setItem(GUESS_DISTRIBUTION_KEY, "{}");
      expect(loadDistribution()).toEqual({ 1: 0, 2: 0, 3: 2, 4: 0, 5: 0 });
      vi.restoreAllMocks();
    });
  });

  describe("recordWin", () => {
    it("increments and persists the attempts bucket", () => {
      recordWin(3);
      recordWin(3);
      const result = recordWin(1);
      const expected = { 1: 1, 2: 0, 3: 2, 4: 0, 5: 0 };
      expect(result).toEqual(expected);
      expect(JSON.parse(localStorage.getItem(GUESS_DISTRIBUTION_KEY)!)).toEqual(expected);
      expect(loadDistribution()).toEqual(expected);
    });

    it.each([[0], [6], [2.5], [-1], [NaN]])("ignores out-of-range attempts %s", (attempts) => {
      expect(recordWin(attempts)).toEqual(EMPTY);
      expect(localStorage.getItem(GUESS_DISTRIBUTION_KEY)).toBeNull();
    });

    it("leaves an existing stored value untouched for out-of-range attempts", () => {
      const raw = JSON.stringify({ 1: 1, 2: 0, 3: 2, 4: 0, 5: 0 });
      localStorage.setItem(GUESS_DISTRIBUTION_KEY, raw);
      recordWin(0);
      recordWin(6);
      recordWin(2.5);
      expect(localStorage.getItem(GUESS_DISTRIBUTION_KEY)).toBe(raw);
    });

    it("never touches STATS_KEY", () => {
      recordWin(2);
      expect(localStorage.getItem(STATS_KEY)).toBeNull();

      recordResult(true, "2026-04-15");
      const statsBefore = localStorage.getItem(STATS_KEY);
      recordWin(4);
      expect(localStorage.getItem(STATS_KEY)).toBe(statsBefore);
    });
  });

  describe("recordResult is unchanged", () => {
    it("writes the same STATS_KEY shape and leaves the distribution alone", () => {
      recordResult(true, "2026-04-15");
      recordResult(false, "2026-04-16");
      expect(JSON.parse(localStorage.getItem(STATS_KEY)!)).toEqual({
        played: 2,
        won: 1,
        lost: 1,
        streak: 0,
        longestStreak: 1,
        lastPlayedDate: "2026-04-16",
      });
      expect(localStorage.getItem(GUESS_DISTRIBUTION_KEY)).toBeNull();
    });
  });
});
