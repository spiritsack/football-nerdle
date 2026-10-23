import { describe, it, expect, vi } from "vitest";
import {
  DailyPuzzleError, MAX_FALLBACK_ATTEMPTS, isNoRowsError, orderFallbackCandidates, pickPlayableCandidate,
} from "../api/dailyFallback";
import type { Player } from "../types";

const player = (id: string): Player => ({ id, name: `Player ${id}`, thumbnail: "", nationality: "" });
const seeds = ["a", "b", "c", "d", "e"].map(player);
const ids = (players: Player[]) => players.map((p) => p.id);

/** A repeatable `random` that cycles through `values`. */
function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("orderFallbackCandidates", () => {
  it("returns only unused seeds when any exist", () => {
    const result = orderFallbackCandidates(seeds, new Set(["a", "c", "e"]), sequence(0.3, 0.7));
    expect(ids(result).sort()).toEqual(["b", "d"]);
  });

  it("returns every seed when all have been used", () => {
    const result = orderFallbackCandidates(seeds, new Set(ids(seeds)), sequence(0.5));
    expect(ids(result).sort()).toEqual(ids(seeds));
  });

  it("returns an empty array for no seeds", () => {
    expect(orderFallbackCandidates([], new Set())).toEqual([]);
  });

  it("is deterministic for a fixed random", () => {
    const first = orderFallbackCandidates(seeds, new Set(), sequence(0.1, 0.9, 0.4, 0.6));
    const second = orderFallbackCandidates(seeds, new Set(), sequence(0.1, 0.9, 0.4, 0.6));
    expect(ids(first)).toEqual(ids(second));
  });

  it("shuffles (Fisher-Yates) rather than keeping the seed order", () => {
    // random() = 0 always swaps position i with 0: a b c d e -> b c d e a
    expect(ids(orderFallbackCandidates(seeds, new Set(), () => 0))).toEqual(["b", "c", "d", "e", "a"]);
  });

  it("does not mutate the seed list", () => {
    const copy = [...seeds];
    orderFallbackCandidates(seeds, new Set(), () => 0);
    expect(seeds).toEqual(copy);
  });
});

describe("pickPlayableCandidate", () => {
  it("returns the first candidate whose check resolves true", async () => {
    const isPlayable = vi.fn(async (p: Player) => p.id === "b" || p.id === "c");
    expect(await pickPlayableCandidate(seeds, isPlayable, MAX_FALLBACK_ATTEMPTS)).toEqual(player("b"));
    expect(isPlayable).toHaveBeenCalledTimes(2);
  });

  it("skips candidates whose check throws", async () => {
    const isPlayable = vi.fn(async (p: Player) => {
      if (p.id === "a") throw new Error("lookup failed");
      return true;
    });
    expect(await pickPlayableCandidate(seeds, isPlayable, MAX_FALLBACK_ATTEMPTS)).toEqual(player("b"));
    expect(isPlayable).toHaveBeenCalledTimes(2);
  });

  it("returns null after maxAttempts failed checks and checks no more", async () => {
    const isPlayable = vi.fn(async () => false);
    expect(await pickPlayableCandidate(seeds, isPlayable, 3)).toBeNull();
    expect(isPlayable).toHaveBeenCalledTimes(3);
  });

  it("never checks past maxAttempts even if a later candidate is playable", async () => {
    const isPlayable = vi.fn(async (p: Player) => p.id === "e");
    expect(await pickPlayableCandidate(seeds, isPlayable, 4)).toBeNull();
    expect(isPlayable).toHaveBeenCalledTimes(4);
  });

  it("returns null when the list runs out first", async () => {
    const isPlayable = vi.fn(async () => false);
    expect(await pickPlayableCandidate(seeds.slice(0, 2), isPlayable, MAX_FALLBACK_ATTEMPTS)).toBeNull();
    expect(isPlayable).toHaveBeenCalledTimes(2);
  });

  it("returns null for an empty list", async () => {
    const isPlayable = vi.fn(async () => true);
    expect(await pickPlayableCandidate([], isPlayable, MAX_FALLBACK_ATTEMPTS)).toBeNull();
    expect(isPlayable).not.toHaveBeenCalled();
  });

  it("allows five attempts by default", () => {
    expect(MAX_FALLBACK_ATTEMPTS).toBe(5);
  });
});

describe("DailyPuzzleError", () => {
  it("is an Error carrying the message", () => {
    const e = new DailyPuzzleError("nope");
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe("nope");
  });
});

describe("isNoRowsError", () => {
  it("isNoRowsError is true for PostgREST's no-rows code", () => {
    expect(isNoRowsError({ code: "PGRST116" })).toBe(true);
  });

  it.each([
    ["a server error", { code: "500" }],
    ["a fetch error with an empty code", { code: "" }],
    ["an error without a code", {}],
    ["null", null],
    ["undefined", undefined],
  ])("isNoRowsError is false for %s", (_label, error) => {
    expect(isNoRowsError(error)).toBe(false);
  });
});
