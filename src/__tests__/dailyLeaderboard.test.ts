import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

import { getDailyLeaderboard, submitDailyResult, toLeaderboardEntries } from "../api/dailyLeaderboard";

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

describe("submitDailyResult", () => {
  const DATE = "2026-10-14";
  const KEY = `football-nerdle-lb-${DATE}`;
  let store: Map<string, string>;
  let insert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    });
    insert = vi.fn().mockResolvedValue({ error: null });
    mocks.client = { rpc: vi.fn(), from: vi.fn().mockReturnValue({ insert }) };
    vi.stubEnv("DEV", false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is a no-op in dev builds", async () => {
    vi.stubEnv("DEV", true);
    await expect(submitDailyResult(DATE, true, 3)).resolves.toBeUndefined();
    expect(from()).not.toHaveBeenCalled();
    expect(store.has(KEY)).toBe(false);
  });

  it("inserts the result in production builds", async () => {
    await submitDailyResult(DATE, true, 3);
    expect(from()).toHaveBeenCalledWith("daily_results");
    expect(insert).toHaveBeenCalledWith({ date: DATE, attempts: 3 });
    expect(store.get(KEY)).toBe("1");
  });

  it("records a loss as 0 attempts", async () => {
    await submitDailyResult(DATE, false, 5);
    expect(insert).toHaveBeenCalledWith({ date: DATE, attempts: 0 });
  });

  it("skips when already submitted", async () => {
    store.set(KEY, "1");
    await submitDailyResult(DATE, true, 2);
    expect(from()).not.toHaveBeenCalled();
  });

  it("does not mark submitted on insert error", async () => {
    insert.mockResolvedValue({ error: { message: "boom" } });
    await expect(submitDailyResult(DATE, true, 3)).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalled();
    expect(store.has(KEY)).toBe(false);
  });
});
