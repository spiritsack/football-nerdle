import { describe, it, expect } from "vitest";
import { getDailyPlayerIndex, getDayNumber } from "../pages/GuessThePlayer/helpers";
import { SEED_PLAYERS } from "../data/seedPlayers";

describe("getDailyPlayerIndex", () => {
  it("returns a consistent index for the same date", () => {
    const idx1 = getDailyPlayerIndex("2026-03-26");
    const idx2 = getDailyPlayerIndex("2026-03-26");
    expect(idx1).toBe(idx2);
  });

  it("returns different indices for consecutive dates", () => {
    const idx1 = getDailyPlayerIndex("2026-03-26");
    const idx2 = getDailyPlayerIndex("2026-03-27");
    expect(idx1).not.toBe(idx2);
  });

  it("returns an index within seed player bounds", () => {
    for (let day = 0; day < 365; day++) {
      const date = new Date("2026-03-24T12:00:00Z");
      date.setUTCDate(date.getUTCDate() + day);
      const dateStr = date.toISOString().split("T")[0];
      const idx = getDailyPlayerIndex(dateStr);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(SEED_PLAYERS.length);
    }
  });

  it("day 1 (2026-03-24) returns index 0 (Messi)", () => {
    expect(getDailyPlayerIndex("2026-03-24")).toBe(0);
  });

  it("day 2 (2026-03-25) returns index 1 (Ronaldo)", () => {
    expect(getDailyPlayerIndex("2026-03-25")).toBe(1);
  });

  it("day 3 (2026-03-26) returns index 2 (Neymar)", () => {
    expect(getDailyPlayerIndex("2026-03-26")).toBe(2);
  });

  it("never repeats within the seed player list length", () => {
    const seen = new Set<number>();
    for (let day = 0; day < SEED_PLAYERS.length; day++) {
      // Use UTC date arithmetic to avoid DST issues
      const date = new Date("2026-03-24T12:00:00Z");
      date.setUTCDate(date.getUTCDate() + day);
      const dateStr = date.toISOString().split("T")[0];
      const idx = getDailyPlayerIndex(dateStr);
      expect(seen.has(idx)).toBe(false);
      seen.add(idx);
    }
  });
});

describe("getDayNumber", () => {
  it("returns 1 for the start date", () => {
    expect(getDayNumber("2026-03-24")).toBe(1);
  });

  it("returns 2 for the day after start", () => {
    expect(getDayNumber("2026-03-25")).toBe(2);
  });

  it("returns 3 for 2026-03-26", () => {
    expect(getDayNumber("2026-03-26")).toBe(3);
  });

  it("increments by 1 for each day", () => {
    const day10 = getDayNumber("2026-04-02");
    const day11 = getDayNumber("2026-04-03");
    expect(day11 - day10).toBe(1);
  });
});
