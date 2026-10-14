import { describe, it, expect } from "vitest";
import { getMsUntilNextDay } from "../utils/dates";

describe("getMsUntilNextDay", () => {
  it("returns the time left until local midnight ending the day", () => {
    expect(getMsUntilNextDay("2026-10-14", new Date(2026, 9, 14, 23, 59, 30))).toBe(30_000);
  });

  it("returns a full day at local 00:00:00 of the same day", () => {
    expect(getMsUntilNextDay("2026-10-14", new Date(2026, 9, 14, 0, 0, 0))).toBe(86_400_000);
  });

  it("returns 0 exactly at the next midnight", () => {
    expect(getMsUntilNextDay("2026-10-14", new Date(2026, 9, 15, 0, 0, 0))).toBe(0);
  });

  it("returns 0 when now is on a later day", () => {
    expect(getMsUntilNextDay("2026-10-14", new Date(2026, 9, 16, 12, 0, 0))).toBe(0);
  });

  it("rolls over month and year boundaries", () => {
    expect(getMsUntilNextDay("2026-10-31", new Date(2026, 9, 31, 23, 0, 0))).toBe(3_600_000);
    expect(getMsUntilNextDay("2026-12-31", new Date(2026, 11, 31, 23, 59, 59))).toBe(1_000);
  });
});
