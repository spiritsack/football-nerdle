import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Response = { data: unknown; error: unknown };

const mocks = vi.hoisted(() => ({
  client: null as { from: ReturnType<typeof vi.fn> } | null,
}));

vi.mock("../api/supabaseClient", () => ({
  get supabase() {
    return mocks.client;
  },
}));

import { getRandomCachedPlayer, orderByIds } from "../api/playerCache";

interface Call {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Call[];
let responses: Record<string, Response>;

/** Chainable PostgREST-like stub: every method returns the builder, awaiting it resolves to the table's response. */
function makeClient() {
  return {
    from: vi.fn((table: string) => {
      calls.push({ table, method: "from", args: [table] });
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "single", "limit"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.then = (resolve: (r: Response) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(responses[table] ?? { data: null, error: null }).then(resolve, reject);
      return builder;
    }),
  };
}

interface ClubRow {
  club_id: string;
  year_joined: string;
  year_departed: string;
  is_hidden: boolean;
  is_youth_team: boolean;
  is_loan: boolean;
  sort_order: number | null;
  clubs: { id: string; name: string; badge: string } | null;
}

function club(id: string, name: string, joined: string, extra: Partial<ClubRow> = {}): ClubRow {
  return {
    club_id: id,
    year_joined: joined,
    year_departed: String(Number(joined) + 2),
    is_hidden: false,
    is_youth_team: false,
    is_loan: false,
    sort_order: null,
    clubs: { id, name, badge: "" },
    ...extra,
  };
}

function playerRow(id: string, clubs: ClubRow[]) {
  return {
    id,
    name: `Player ${id}`,
    thumbnail: "",
    nationality_id: "1",
    position: "Midfield",
    date_born: "1990-01-01",
    cached_at: "2026-01-01",
    is_legacy: null,
    countries: { name: "Norway" },
    player_clubs: clubs,
  };
}

const threeClubs = (): ClubRow[] => [club("a", "Club A", "2010"), club("b", "Club B", "2013"), club("c", "Club C", "2016")];

function topClubRows(ids: string[]) {
  return ids.map((player_id) => ({ player_id, clubs: { is_top_club: true } }));
}

const inCall = () => calls.find((c) => c.table === "players" && c.method === "in");
const inIds = () => inCall()!.args[1] as string[];

beforeEach(() => {
  calls = [];
  responses = {
    // Same data in every test: getCountryNames caches across calls
    countries: { data: [{ name: "Norway" }], error: null },
  };
  mocks.client = makeClient();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("orderByIds", () => {
  it("orders rows by id list and drops missing ids", () => {
    const rows = [{ id: "3" }, { id: "1" }];
    expect(orderByIds(rows, ["1", "2", "3"])).toEqual([{ id: "1" }, { id: "3" }]);
  });
});

describe("getRandomCachedPlayer", () => {
  it("fetches candidates in a single batched query", async () => {
    const ids = Array.from({ length: 30 }, (_, i) => String(i + 1));
    responses.player_clubs = { data: topClubRows([...ids, ...ids]), error: null };
    responses.players = { data: ids.map((id) => playerRow(id, threeClubs())), error: null };

    const player = await getRandomCachedPlayer();
    expect(player).not.toBeNull();

    const dbTables = calls.filter((c) => c.method === "from" && c.table !== "countries").map((c) => c.table);
    expect(dbTables).toEqual(["player_clubs", "players"]);
    expect(calls.filter((c) => c.table === "players" && c.method === "in")).toHaveLength(1);
    expect(inCall()!.args[0]).toBe("id");
    expect(inIds().length).toBe(20);
    expect(new Set(inIds()).size).toBe(20);
    expect(calls.some((c) => c.table === "players" && c.method === "eq")).toBe(false);
  });

  it("picks first eligible candidate in shuffled order", async () => {
    responses.player_clubs = { data: topClubRows(["1", "2", "3"]), error: null };
    // DB returns rows in a different order than requested
    responses.players = {
      data: [playerRow("1", threeClubs()), playerRow("2", threeClubs()), playerRow("3", threeClubs())],
      error: null,
    };

    const player = await getRandomCachedPlayer();
    expect(player!.id).toBe(inIds()[0]);
  });

  it("picks first eligible candidate regardless of DB row order", async () => {
    // Identity shuffle: a constant comparator result of 0 keeps insertion order
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    responses.player_clubs = { data: topClubRows(["1", "2", "3"]), error: null };
    responses.players = {
      data: [playerRow("3", threeClubs()), playerRow("2", threeClubs()), playerRow("1", threeClubs())],
      error: null,
    };

    const player = await getRandomCachedPlayer();
    expect(inIds()).toEqual(["1", "2", "3"]);
    expect(player!.id).toBe("1");
    expect(player!.formerTeams.map((t) => t.teamName)).toEqual(["Club A", "Club B", "Club C"]);
  });

  it("skips candidates with too few clubs", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    responses.player_clubs = { data: topClubRows(["1", "2", "3", "4", "5", "6", "7"]), error: null };
    responses.players = {
      data: [
        playerRow("1", []),
        playerRow("2", [club("a", "Club A", "2010"), club("b", "Club B", "2013")]),
        playerRow("3", [...threeClubs().slice(0, 2), club("h", "Hidden FC", "2018", { is_hidden: true })]),
        playerRow("4", [...threeClubs().slice(0, 2), club("y", "Youth FC", "2005", { is_youth_team: true })]),
        playerRow("5", [...threeClubs().slice(0, 2), club("n", "Norway", "2018")]),
        playerRow("6", [...threeClubs().slice(0, 2), { ...club("x", "", "2018"), clubs: null }]),
        playerRow("7", threeClubs()),
      ],
      error: null,
    };

    const player = await getRandomCachedPlayer();
    expect(player!.id).toBe("7");
  });

  it("skips candidate ids with no players row", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    responses.player_clubs = { data: topClubRows(["1", "2"]), error: null };
    responses.players = { data: [playerRow("2", threeClubs())], error: null };

    expect((await getRandomCachedPlayer())!.id).toBe("2");
  });

  it("returns null when supabase is not configured", async () => {
    mocks.client = null;
    expect(await getRandomCachedPlayer()).toBeNull();
  });

  it("returns null when the player_clubs query errors", async () => {
    responses.player_clubs = { data: null, error: { message: "boom" } };
    expect(await getRandomCachedPlayer()).toBeNull();
    expect(calls.some((c) => c.table === "players")).toBe(false);
  });

  it("returns null when the player_clubs query returns empty", async () => {
    responses.player_clubs = { data: [], error: null };
    expect(await getRandomCachedPlayer()).toBeNull();
    expect(calls.some((c) => c.table === "players")).toBe(false);
  });

  it("returns null when the players query errors", async () => {
    responses.player_clubs = { data: topClubRows(["1"]), error: null };
    responses.players = { data: null, error: { message: "boom" } };
    expect(await getRandomCachedPlayer()).toBeNull();
  });

  it("returns null when the players query returns empty", async () => {
    responses.player_clubs = { data: topClubRows(["1"]), error: null };
    responses.players = { data: [], error: null };
    expect(await getRandomCachedPlayer()).toBeNull();
  });

  it("returns null when no candidate has enough clubs", async () => {
    responses.player_clubs = { data: topClubRows(["1", "2"]), error: null };
    responses.players = {
      data: [playerRow("1", []), playerRow("2", threeClubs().slice(0, 2))],
      error: null,
    };
    expect(await getRandomCachedPlayer()).toBeNull();
  });
});
