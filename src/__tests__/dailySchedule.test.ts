import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Player, PlayerWithTeams } from "../types";

type QueryResult = { data: unknown; error: { code?: string; message?: string } | null };

const mocks = vi.hoisted(() => ({
  /** Results for each `.single()` read of today's row, in call order. */
  singleResults: [] as QueryResult[],
  /** Result of the used-rows read (`select("player_id")` with no filter). */
  usedRowsResult: { data: [], error: null } as QueryResult,
  inserted: [] as unknown[],
  from: vi.fn(),
}));

vi.mock("../api/supabaseClient", () => ({
  supabase: { from: mocks.from },
}));

vi.mock("../api/playerCache", () => ({
  getPlayerWithTeamsCached: vi.fn(async (player: Player): Promise<PlayerWithTeams> => ({
    ...player,
    formerTeams: [{ teamId: "1", teamName: "Club", badge: "", yearJoined: "2010", yearDeparted: "2015" }],
  })),
}));

import { getOrCreateDailyPlayer } from "../api/dailySchedule";
import { DailyPuzzleError, UNLOADABLE_PUZZLE_MESSAGE } from "../api/dailyFallback";
import { SEED_PLAYERS } from "../data/seedPlayers";

const DATE = "2026-10-23";
const NO_ROW = { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" };

/** A chainable stand-in for `from(table)`: `select().eq().single()`, awaitable `select()`, `insert()`. */
function builder() {
  return {
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve(mocks.singleResults.shift() ?? { data: null, error: NO_ROW }),
      }),
      then: (resolve: (r: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(mocks.usedRowsResult).then(resolve, reject),
    }),
    // The read-back after an insert then finds the row this client saved
    insert: (row: { player_id: string }) => {
      mocks.inserted.push(row);
      mocks.singleResults.push({ data: { player_id: row.player_id }, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  };
}

const scheduleCalls = () => mocks.from.mock.calls.filter(([table]) => table === "daily_schedule").length;

beforeEach(() => {
  mocks.singleResults = [];
  mocks.usedRowsResult = { data: [], error: null };
  mocks.inserted = [];
  mocks.from.mockReset();
  mocks.from.mockImplementation(() => builder());
});

describe("getOrCreateDailyPlayer", () => {
  it("returns today's scheduled player", async () => {
    const seed = SEED_PLAYERS[3];
    mocks.singleResults = [{ data: { player_id: seed.id }, error: null }];

    await expect(getOrCreateDailyPlayer(DATE)).resolves.toEqual(seed);
    expect(scheduleCalls()).toBe(1);
    expect(mocks.inserted).toHaveLength(0);
  });

  it("auto-picks when today has no row", async () => {
    mocks.singleResults = [{ data: null, error: NO_ROW }];

    const picked = await getOrCreateDailyPlayer(DATE);

    expect(SEED_PLAYERS).toContainEqual(picked);
    // Today's read, used rows, insert, read-back
    expect(scheduleCalls()).toBe(4);
    expect(mocks.inserted).toEqual([{ date: DATE, player_id: picked.id }]);
  });

  it.each([
    ["a server error", { code: "500", message: "Internal Server Error" }],
    ["a fetch error", { code: "", message: "TypeError: Failed to fetch" }],
  ])("throws and never auto-picks when today's read fails (%s)", async (_label, error) => {
    mocks.singleResults = [{ data: null, error }];

    const result = getOrCreateDailyPlayer(DATE);
    await expect(result).rejects.toBeInstanceOf(DailyPuzzleError);
    await expect(result).rejects.toThrow(UNLOADABLE_PUZZLE_MESSAGE);
    // No used-rows read and no insert
    expect(scheduleCalls()).toBe(1);
    expect(mocks.inserted).toHaveLength(0);
  });
});
