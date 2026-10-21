import { describe, it, expect, vi, afterEach } from "vitest";
import { formatLocalDate, getMsUntilNextDay, getTodayString } from "../utils/dates";

describe("formatLocalDate", () => {
  it("formatLocalDate uses the local calendar day", () => {
    // 00:30 local is still the previous day in UTC east of Greenwich
    expect(formatLocalDate(new Date(2026, 9, 22, 0, 30))).toBe("2026-10-22");
  });

  it("pads month and day", () => {
    // 23:59 local is already the next day in UTC west of Greenwich
    expect(formatLocalDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("getTodayString", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the local date just after local midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 22, 0, 30));
    expect(getTodayString()).toBe("2026-10-22");
    expect(getTodayString()).toBe(formatLocalDate(new Date()));
  });
});

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
