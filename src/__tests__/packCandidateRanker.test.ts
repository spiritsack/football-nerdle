import { describe, it, expect } from "vitest";
import { rankClubCandidates, type CandidateInput } from "../pages/Admin/packCandidateRanker";

function makeInput(overrides: Partial<CandidateInput> = {}): CandidateInput {
  return {
    id: "p1",
    name: "Player One",
    thumbnail: "https://x/p1.jpg",
    stints: [{ yearJoined: "2018", yearDeparted: "2024", isLoan: false, isYouth: false }],
    hasTopLeagueElsewhere: false,
    ...overrides,
  };
}

const NO_SEED = new Set<string>();

describe("rankClubCandidates", () => {
  it("returns an empty array for empty input", () => {
    expect(rankClubCandidates([], NO_SEED)).toEqual([]);
  });

  it("excludes players with no non-youth stints", () => {
    const input = [
      makeInput({ id: "p1" }),
      makeInput({
        id: "youth-only",
        stints: [{ yearJoined: "2010", yearDeparted: "2014", isLoan: false, isYouth: true }],
      }),
    ];
    const ranked = rankClubCandidates(input, NO_SEED);
    expect(ranked.map((r) => r.id)).toEqual(["p1"]);
  });

  it("excludes players without a thumbnail", () => {
    const input = [
      makeInput({ id: "p1" }),
      makeInput({ id: "no-thumb", thumbnail: "" }),
    ];
    const ranked = rankClubCandidates(input, NO_SEED);
    expect(ranked.map((r) => r.id)).toEqual(["p1"]);
  });

  it("ranks longer tenure higher than shorter tenure", () => {
    const input = [
      makeInput({ id: "short", stints: [{ yearJoined: "2022", yearDeparted: "2024", isLoan: false, isYouth: false }] }),
      makeInput({ id: "long", stints: [{ yearJoined: "2010", yearDeparted: "2024", isLoan: false, isYouth: false }] }),
    ];
    const ranked = rankClubCandidates(input, NO_SEED);
    expect(ranked.map((r) => r.id)).toEqual(["long", "short"]);
  });

  it("seed-list bonus boosts a player above a slightly-longer-tenure non-seed player", () => {
    const input = [
      // Non-seed with 7-year tenure → score = 7
      makeInput({ id: "long", stints: [{ yearJoined: "2017", yearDeparted: "2024", isLoan: false, isYouth: false }] }),
      // Seed with 5-year tenure → score = 5 + SEED_BONUS (>= 6 to beat 7)
      makeInput({ id: "seed", stints: [{ yearJoined: "2019", yearDeparted: "2024", isLoan: false, isYouth: false }] }),
    ];
    const ranked = rankClubCandidates(input, new Set(["seed"]));
    expect(ranked[0].id).toBe("seed");
  });

  it("top-5-league bonus boosts otherwise-equal players", () => {
    const input = [
      makeInput({ id: "no-top" }),
      makeInput({ id: "top-league", hasTopLeagueElsewhere: true }),
    ];
    const ranked = rankClubCandidates(input, NO_SEED);
    expect(ranked[0].id).toBe("top-league");
  });

  it("loan penalty drops a player with any loan stint below a non-loan equivalent", () => {
    const input = [
      makeInput({ id: "permanent" }),
      makeInput({
        id: "loaned",
        stints: [
          { yearJoined: "2018", yearDeparted: "2020", isLoan: false, isYouth: false },
          { yearJoined: "2022", yearDeparted: "2024", isLoan: true, isYouth: false },
        ],
      }),
    ];
    const ranked = rankClubCandidates(input, NO_SEED);
    expect(ranked[0].id).toBe("permanent");
  });

  it("respects an optional limit", () => {
    const input = Array.from({ length: 50 }, (_, i) => makeInput({ id: `p${i}` }));
    const ranked = rankClubCandidates(input, NO_SEED, { limit: 30 });
    expect(ranked).toHaveLength(30);
  });

  it("derives a tenure label spanning the first join and last departure across non-youth stints", () => {
    const ranked = rankClubCandidates(
      [
        makeInput({
          id: "p1",
          stints: [
            { yearJoined: "2010", yearDeparted: "2014", isLoan: false, isYouth: false },
            { yearJoined: "2020", yearDeparted: "2024", isLoan: false, isYouth: false },
          ],
        }),
      ],
      NO_SEED,
    );
    expect(ranked[0].tenureLabel).toBe("2010–2024");
  });

  it("handles ongoing stints (no yearDeparted) by labeling 'present'", () => {
    const ranked = rankClubCandidates(
      [
        makeInput({
          id: "p1",
          stints: [{ yearJoined: "2018", yearDeparted: "", isLoan: false, isYouth: false }],
        }),
      ],
      NO_SEED,
    );
    expect(ranked[0].tenureLabel).toMatch(/2018–present/);
  });
});
