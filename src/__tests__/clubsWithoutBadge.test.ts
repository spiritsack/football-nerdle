import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  client: { rpc: vi.fn() } as { rpc: ReturnType<typeof vi.fn> } | null,
}));

vi.mock("../api/supabaseClient", () => ({
  get supabase() {
    return mocks.client;
  },
}));

import { getClubsWithoutBadge } from "../api/adminApi";

const rpc = () => mocks.client!.rpc;

describe("getClubsWithoutBadge", () => {
  beforeEach(() => {
    mocks.client = { rpc: vi.fn() };
  });

  it("asks the get_clubs_without_badge RPC for one page", async () => {
    rpc().mockResolvedValue({ data: [], error: null });
    await getClubsWithoutBadge(40, 20);
    expect(rpc()).toHaveBeenCalledWith("get_clubs_without_badge", { p_offset: 40, p_limit: 20 });
  });

  it("keeps the RPC's most-used-first order and takes the total from the rows", async () => {
    rpc().mockResolvedValue({
      data: [
        { id: "tm_3", name: "Beta FC", transfermarkt_id: null, usage_count: 3, total_count: 5 },
        { id: "tm_2", name: "Alpha FC", transfermarkt_id: "2", usage_count: 2, total_count: 5 },
      ],
      error: null,
    });
    expect(await getClubsWithoutBadge(0, 2)).toEqual({
      clubs: [
        { id: "tm_3", name: "Beta FC", transfermarkt_id: null, usage_count: 3 },
        { id: "tm_2", name: "Alpha FC", transfermarkt_id: "2", usage_count: 2 },
      ],
      total: 5,
    });
  });

  it("returns no clubs and a zero total for an empty page", async () => {
    rpc().mockResolvedValue({ data: [], error: null });
    expect(await getClubsWithoutBadge(0, 20)).toEqual({ clubs: [], total: 0 });
  });

  it("throws the RPC's error message", async () => {
    rpc().mockResolvedValue({ data: null, error: { message: "function get_clubs_without_badge does not exist" } });
    await expect(getClubsWithoutBadge(0, 20)).rejects.toThrow("function get_clubs_without_badge does not exist");
  });

  it("returns nothing when Supabase is not configured", async () => {
    mocks.client = null;
    expect(await getClubsWithoutBadge(0, 20)).toEqual({ clubs: [], total: 0 });
  });
});
