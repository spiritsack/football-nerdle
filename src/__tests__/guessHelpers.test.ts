import { describe, it, expect } from "vitest";
import { getDailyPlayerIndex, getDayNumber } from "../pages/GuessThePlayer/helpers";

describe("getDailyPlayerIndex", () => {
  it("returns a consistent index for the same date", () => {
    const idx1 = getDailyPlayerIndex("2026-03-26");
    const idx2 = getDailyPlayerIndex("2026-03-26");
    expect(idx1).toBe(idx2);
  });

  it("returns different indices for different dates", () => {
    const idx1 = getDailyPlayerIndex("2026-03-26");
    const idx2 = getDailyPlayerIndex("2026-03-27");
    expect(idx1).not.toBe(idx2);
  });

  it("returns an index within seed player bounds", () => {
    // 19 seed players
    for (let day = 1; day <= 365; day++) {
      const date = `2026-${String(Math.ceil(day / 30)).padStart(2, "0")}-${String((day % 30) + 1).padStart(2, "0")}`;
      const idx = getDailyPlayerIndex(date);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(19);
    }
  });

  it("returns 0 for 2026-03-26 (Messi)", () => {
    // Known value from our testing
    expect(getDailyPlayerIndex("2026-03-26")).toBe(0);
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
