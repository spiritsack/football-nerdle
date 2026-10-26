import { describe, it, expect, vi, beforeEach } from "vitest";

type Result = { data: unknown; error: { message: string } | null };

/** A chainable stand-in for `supabase.from(...)`: records every call, resolves to `result` */
function queryBuilder(result: Result) {
  const calls: [string, unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "ilike", "limit", "order", "insert", "single", "or", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return { builder, calls };
}

const mocks = vi.hoisted(() => ({
  client: null as { from: ReturnType<typeof vi.fn> } | null,
}));

vi.mock("../api/supabaseClient", () => ({
  get supabase() {
    return mocks.client;
  },
}));

import { createClub, findSimilarClubs, getCountries } from "../api/adminApi";

function useResults(...results: Result[]) {
  const builders = results.map(queryBuilder);
  let i = 0;
  mocks.client = { from: vi.fn(() => builders[Math.min(i++, builders.length - 1)].builder) };
  return builders;
}

describe("findSimilarClubs", () => {
  beforeEach(() => {
    mocks.client = null;
  });

  it("runs one ilike per search term and never builds an .or() filter", async () => {
    const [first, second] = useResults({ data: [], error: null }, { data: [], error: null });
    await findSimilarClubs("Club Atlético Rovers");
    expect(mocks.client!.from).toHaveBeenCalledWith("clubs");
    const all = [...first.calls, ...second.calls];
    expect(all.some(([m]) => m === "or")).toBe(false);
    expect(all.filter(([m]) => m === "ilike").map(([, args]) => args)).toEqual([
      ["name", "%atletico%"],
      ["name", "%rovers%"],
    ]);
    expect(first.calls).toContainEqual(["limit", [50]]);
  });

  it("escapes % _ and backslash in a term", async () => {
    const [first] = useResults({ data: [], error: null });
    // Every word is short, so the whole name is the search term
    await findSimilarClubs("A%_\\");
    expect(first.calls.find(([m]) => m === "ilike")?.[1]).toEqual(["name", "%a\\%\\_\\\\%"]);
  });

  it("merges the results by id and ranks them, same first", async () => {
    useResults(
      { data: [{ id: "1", name: "AC Milan Primavera", badge: "" }, { id: "tm_5", name: "AC Milan", badge: "x" }], error: null },
    );
    const ranked = await findSimilarClubs("AC Milan");
    expect(ranked.map((r) => [r.club.id, r.match])).toEqual([["tm_5", "same"], ["1", "similar"]]);
  });

  it("throws when a query fails", async () => {
    useResults({ data: null, error: { message: "boom" } });
    await expect(findSimilarClubs("Rovers")).rejects.toThrow("boom");
  });
});

describe("createClub", () => {
  it("inserts an admin_ id, the trimmed name, an empty badge and country_id null when no country is given", async () => {
    const [b] = useResults({ data: { id: "admin_x", name: "Rovers", badge: "" }, error: null });
    const club = await createClub({ name: "  Rovers  " });
    expect(club).toEqual({ id: "admin_x", name: "Rovers", badge: "" });
    const insert = b.calls.find(([m]) => m === "insert")?.[1][0] as Record<string, unknown>;
    expect(insert).toMatchObject({ name: "Rovers", country_id: null, badge: "" });
    expect(insert.id).toMatch(/^admin_/);
    expect(b.calls).toContainEqual(["select", ["id, name, badge"]]);
  });

  it("sends the chosen country", async () => {
    const [b] = useResults({ data: { id: "admin_x", name: "Rovers", badge: "" }, error: null });
    await createClub({ name: "Rovers", countryId: "BR" });
    expect((b.calls.find(([m]) => m === "insert")?.[1][0] as Record<string, unknown>).country_id).toBe("BR");
  });

  it("throws the Supabase error message", async () => {
    useResults({ data: null, error: { message: 'new row violates row-level security policy for table "clubs"' } });
    await expect(createClub({ name: "Rovers" })).rejects.toThrow('new row violates row-level security policy for table "clubs"');
  });
});

describe("getCountries", () => {
  it("selects id and name ordered by name", async () => {
    const [b] = useResults({ data: [{ id: "BR", name: "Brazil" }], error: null });
    expect(await getCountries()).toEqual([{ id: "BR", name: "Brazil" }]);
    expect(b.calls).toEqual([["select", ["id, name"]], ["order", ["name"]]]);
  });
});
