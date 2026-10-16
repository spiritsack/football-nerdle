import { describe, it, expect } from "vitest";
import {
  filterWindows,
  matchRows,
  parseCiRuns,
  summarise,
  type Window,
} from "../../scripts/purgeE2eRowsHelpers";

const window = (runId: number, start: string, end: string): Window => ({
  runId,
  start: new Date(start),
  end: new Date(end),
});

describe("purgeE2eRowsHelpers", () => {
  it("parseCiRuns parses gh output", () => {
    const json = [
      { databaseId: 101, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:08:30Z" },
      { databaseId: 102, createdAt: "2026-09-02T12:00:00Z", updatedAt: "2026-09-02T12:05:00Z" },
    ];
    expect(parseCiRuns(json)).toEqual([
      window(101, "2026-09-01T10:00:00Z", "2026-09-01T10:08:30Z"),
      window(102, "2026-09-02T12:00:00Z", "2026-09-02T12:05:00Z"),
    ]);
    expect(parseCiRuns([])).toEqual([]);
  });

  it("parseCiRuns skips malformed entries", () => {
    const json = [
      null,
      "run",
      42,
      { databaseId: 1, updatedAt: "2026-09-01T10:08:30Z" },
      { databaseId: 2, createdAt: "2026-09-01T10:00:00Z" },
      { databaseId: 3, createdAt: "not a date", updatedAt: "2026-09-01T10:08:30Z" },
      { databaseId: 4, createdAt: "2026-09-01T10:00:00Z", updatedAt: "" },
      { databaseId: 5, createdAt: 123, updatedAt: "2026-09-01T10:08:30Z" },
      { createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:08:30Z" },
      { databaseId: 6, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:08:30Z" },
    ];
    expect(parseCiRuns(json)).toEqual([window(6, "2026-09-01T10:00:00Z", "2026-09-01T10:08:30Z")]);
  });

  it("parseCiRuns rejects non-array", () => {
    expect(() => parseCiRuns({ databaseId: 1 })).toThrow(/JSON array/);
    expect(() => parseCiRuns(null)).toThrow(/JSON array/);
    expect(() => parseCiRuns("[]")).toThrow(/JSON array/);
  });

  it("filterWindows applies cutoff", () => {
    const windows = [
      window(1, "2026-09-01T10:00:00Z", "2026-09-01T10:05:00Z"),
      window(2, "2026-09-05T09:00:00Z", "2026-09-05T09:10:00Z"),
      window(3, "2026-09-10T08:00:00Z", "2026-09-10T08:05:00Z"),
    ];
    const cutoff = new Date("2026-09-05T09:00:00Z");
    expect(filterWindows(windows, cutoff).map((w) => w.runId)).toEqual([1]);
    expect(filterWindows(windows, new Date("2026-09-05T09:00:01Z")).map((w) => w.runId)).toEqual([1, 2]);
    expect(filterWindows(windows)).toEqual(windows);
  });

  it("matchRows inside/slack/outside", () => {
    const windows = [
      window(1, "2026-09-01T10:00:00Z", "2026-09-01T10:10:00Z"),
      window(2, "2026-09-02T10:00:00Z", "2026-09-02T10:10:00Z"),
    ];
    const rows = [
      { id: 1, created_at: "2026-09-01T10:05:00Z" }, // inside run 1
      { id: 2, created_at: "2026-09-01T09:58:00Z" }, // exactly 2 min before start
      { id: 3, created_at: "2026-09-02T10:11:59Z" }, // within slack after run 2
      { id: 4, created_at: "2026-09-01T09:57:59Z" }, // just outside slack
      { id: 5, created_at: "2026-09-02T10:12:01Z" }, // just outside slack
      { id: 6, created_at: "2026-09-03T10:05:00Z" }, // no window that day
      { id: 7, created_at: "garbage" },
    ];
    expect(matchRows(rows, windows)).toEqual([
      { id: 1, created_at: "2026-09-01T10:05:00Z", runId: 1 },
      { id: 2, created_at: "2026-09-01T09:58:00Z", runId: 1 },
      { id: 3, created_at: "2026-09-02T10:11:59Z", runId: 2 },
    ]);
    expect(matchRows(rows, windows, 0).map((r) => r.id)).toEqual([1]);
  });

  it("matchRows empty inputs", () => {
    const windows = [window(1, "2026-09-01T10:00:00Z", "2026-09-01T10:10:00Z")];
    expect(matchRows([], windows)).toEqual([]);
    expect(matchRows([{ created_at: "2026-09-01T10:05:00Z" }], [])).toEqual([]);
  });

  it("summarise counts by date and attempts", () => {
    const matches = [
      { date: "2026-09-02", attempts: 3 },
      { date: "2026-09-01", attempts: 0 },
      { date: "2026-09-01", attempts: 3 },
      { date: "2026-09-01", attempts: 0 },
      { date: "2026-09-02", attempts: 3 },
    ];
    expect(summarise(matches)).toEqual([
      { date: "2026-09-01", attempts: 0, count: 2 },
      { date: "2026-09-01", attempts: 3, count: 1 },
      { date: "2026-09-02", attempts: 3, count: 2 },
    ]);
    expect(summarise([])).toEqual([]);
  });
});
