import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  client: {
    rpc: vi.fn(),
    from: vi.fn(),
  } as { rpc: ReturnType<typeof vi.fn>; from: ReturnType<typeof vi.fn> } | null,
}));

vi.mock("../api/supabaseClient", () => ({
  get supabase() {
    return mocks.client;
  },
}));

import { getDailyLeaderboard, toLeaderboardEntries } from "../api/dailyLeaderboard";

const rpc = () => mocks.client!.rpc;
const from = () => mocks.client!.from;

describe("toLeaderboardEntries", () => {
  it("returns [] for null", () => {
    expect(toLeaderboardEntries(null)).toEqual([]);
  });

  it("sorts by attempts ascending", () => {
    const rows = [
      { attempts: 3, count: 2 },
      { attempts: 0, count: 5 },
      { attempts: 1, count: 1 },
    ];
    expect(toLeaderboardEntries(rows)).toEqual([
      { attempts: 0, count: 5 },
      { attempts: 1, count: 1 },
      { attempts: 3, count: 2 },
    ]);
  });

  it("converts string and bigint-like counts to numbers", () => {
    const rows = [
      { attempts: "2", count: "7" },
      { attempts: 1, count: BigInt(4) },
    ];
    expect(toLeaderboardEntries(rows)).toEqual([
      { attempts: 1, count: 4 },
      { attempts: 2, count: 7 },
    ]);
  });

  it("drops malformed rows", () => {
    const rows = [
      null,
      "nope",
      { attempts: "x", count: 3 },
      { attempts: 1, count: "abc" },
      { attempts: 2 },
      { attempts: 3, count: 0 },
      { attempts: 4, count: -1 },
      { attempts: 5, count: 2 },
    ];
    expect(toLeaderboardEntries(rows)).toEqual([{ attempts: 5, count: 2 }]);
  });
});

describe("getDailyLeaderboard", () => {
  beforeEach(() => {
    mocks.client = { rpc: vi.fn(), from: vi.fn() };
  });

  it("calls the get_daily_leaderboard RPC with the date", async () => {
    rpc().mockResolvedValue({
      data: [
        { attempts: 2, count: 3 },
        { attempts: 0, count: 1 },
      ],
      error: null,
    });
    const result = await getDailyLeaderboard("2026-10-14");
    expect(rpc()).toHaveBeenCalledWith("get_daily_leaderboard", { p_date: "2026-10-14" });
    expect(from()).not.toHaveBeenCalled();
    expect(result).toEqual([
      { attempts: 0, count: 1 },
      { attempts: 2, count: 3 },
    ]);
  });

  it("returns [] when RPC returns no rows", async () => {
    rpc().mockResolvedValue({ data: [], error: null });
    expect(await getDailyLeaderboard("2026-10-14")).toEqual([]);
  });

  it("returns [] when RPC returns null data", async () => {
    rpc().mockResolvedValue({ data: null, error: null });
    expect(await getDailyLeaderboard("2026-10-14")).toEqual([]);
  });

  it("returns [] on RPC error", async () => {
    rpc().mockResolvedValue({
      data: null,
      error: { message: "function get_daily_leaderboard does not exist", code: "PGRST202" },
    });
    await expect(getDailyLeaderboard("2026-10-14")).resolves.toEqual([]);
  });

  it("returns [] when supabase is null", async () => {
    mocks.client = null;
    expect(await getDailyLeaderboard("2026-10-14")).toEqual([]);
  });
});
