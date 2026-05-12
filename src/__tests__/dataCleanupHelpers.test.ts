import { describe, it, expect } from "vitest";
import {
  pickDefaultWinner,
  scoreColor,
  areStintsOverlapping,
  computeMergedRange,
  isFieldConflict,
} from "../pages/Admin/DataCleanup/helpers";
import type { PlayerCandidate, ClubCandidate } from "../pages/Admin/DataCleanup/types";

function makePlayerCandidate(overrides: Partial<PlayerCandidate> = {}): PlayerCandidate {
  return {
    id_a: "p1",
    id_b: "p2",
    name_a: "Player A",
    name_b: "Player B",
    dob_a: "",
    dob_b: "",
    nationality_a: "",
    nationality_b: "",
    thumbnail_a: "",
    thumbnail_b: "",
    position_a: "",
    position_b: "",
    source_a: "transfermarkt",
    source_b: "wikidata",
    transfermarkt_id_a: null,
    transfermarkt_id_b: null,
    stint_count_a: 0,
    stint_count_b: 0,
    score: 0.85,
    name_sim: 0.82,
    dob_match: false,
    same_nationality: false,
    cross_source: true,
    ...overrides,
  };
}

function makeClubCandidate(overrides: Partial<ClubCandidate> = {}): ClubCandidate {
  return {
    id_a: "c1",
    id_b: "c2",
    name_a: "Club A",
    name_b: "Club B",
    country_a: "",
    country_b: "",
    badge_a: "",
    badge_b: "",
    player_count_a: 0,
    player_count_b: 0,
    score: 0.80,
    name_sim: 0.75,
    same_country: false,
    roster_overlap: 0,
    shared_player_count: 0,
    ...overrides,
  };
}

describe("pickDefaultWinner", () => {
  describe("players", () => {
    it("picks the player with more stints", () => {
      const c = makePlayerCandidate({ stint_count_a: 5, stint_count_b: 3 });
      expect(pickDefaultWinner(c)).toBe("a");
    });

    it("picks the other player if they have more stints", () => {
      const c = makePlayerCandidate({ stint_count_a: 2, stint_count_b: 7 });
      expect(pickDefaultWinner(c)).toBe("b");
    });

    it("breaks stint tie with transfermarkt_id", () => {
      const c = makePlayerCandidate({
        stint_count_a: 3,
        stint_count_b: 3,
        transfermarkt_id_a: null,
        transfermarkt_id_b: "12345",
      });
      expect(pickDefaultWinner(c)).toBe("b");
    });

    it("breaks transfermarkt_id tie with thumbnail", () => {
      const c = makePlayerCandidate({
        stint_count_a: 3,
        stint_count_b: 3,
        transfermarkt_id_a: null,
        transfermarkt_id_b: null,
        thumbnail_a: "https://img.example.com/photo.jpg",
        thumbnail_b: "",
      });
      expect(pickDefaultWinner(c)).toBe("a");
    });

    it("defaults to 'a' when all tiebreakers are equal", () => {
      const c = makePlayerCandidate({
        stint_count_a: 3,
        stint_count_b: 3,
      });
      expect(pickDefaultWinner(c)).toBe("a");
    });
  });

  describe("clubs", () => {
    it("picks the club with more players", () => {
      const c = makeClubCandidate({ player_count_a: 20, player_count_b: 5 });
      expect(pickDefaultWinner(c)).toBe("a");
    });

    it("picks the other club if it has more players", () => {
      const c = makeClubCandidate({ player_count_a: 3, player_count_b: 15 });
      expect(pickDefaultWinner(c)).toBe("b");
    });

    it("breaks tie with badge presence", () => {
      const c = makeClubCandidate({
        player_count_a: 10,
        player_count_b: 10,
        badge_a: "",
        badge_b: "https://img.example.com/badge.png",
      });
      expect(pickDefaultWinner(c)).toBe("b");
    });

    it("defaults to 'a' when all tiebreakers are equal", () => {
      const c = makeClubCandidate({
        player_count_a: 10,
        player_count_b: 10,
      });
      expect(pickDefaultWinner(c)).toBe("a");
    });
  });
});

describe("scoreColor", () => {
  it("returns green for scores >= 0.95", () => {
    expect(scoreColor(0.95)).toBe("text-green-400");
    expect(scoreColor(1.0)).toBe("text-green-400");
  });

  it("returns yellow for scores between 0.70 and 0.95", () => {
    expect(scoreColor(0.70)).toBe("text-yellow-400");
    expect(scoreColor(0.85)).toBe("text-yellow-400");
    expect(scoreColor(0.949)).toBe("text-yellow-400");
  });

  it("returns gray for scores below 0.70", () => {
    expect(scoreColor(0.69)).toBe("text-gray-400");
    expect(scoreColor(0.5)).toBe("text-gray-400");
    expect(scoreColor(0.0)).toBe("text-gray-400");
  });
});

describe("areStintsOverlapping", () => {
  it("detects overlapping year ranges", () => {
    expect(areStintsOverlapping(
      { year_joined: "2018", year_departed: "2020" },
      { year_joined: "2019", year_departed: "2021" },
    )).toBe(true);
  });

  it("detects adjacent stints (departed = joined)", () => {
    expect(areStintsOverlapping(
      { year_joined: "2015", year_departed: "2018" },
      { year_joined: "2018", year_departed: "2021" },
    )).toBe(true);
  });

  it("detects adjacent stints (gap of 1 year)", () => {
    expect(areStintsOverlapping(
      { year_joined: "2015", year_departed: "2017" },
      { year_joined: "2018", year_departed: "2021" },
    )).toBe(true);
  });

  it("returns false for non-overlapping stints with gap > 1", () => {
    expect(areStintsOverlapping(
      { year_joined: "2010", year_departed: "2013" },
      { year_joined: "2018", year_departed: "2021" },
    )).toBe(false);
  });

  it("handles empty year_departed as ongoing (current year)", () => {
    expect(areStintsOverlapping(
      { year_joined: "2020", year_departed: "" },
      { year_joined: "2022", year_departed: "2023" },
    )).toBe(true);
  });

  it("handles empty year_joined as unknown — returns false", () => {
    expect(areStintsOverlapping(
      { year_joined: "", year_departed: "2020" },
      { year_joined: "2019", year_departed: "2021" },
    )).toBe(false);
  });

  it("returns false when both year_joined are empty", () => {
    expect(areStintsOverlapping(
      { year_joined: "", year_departed: "" },
      { year_joined: "", year_departed: "" },
    )).toBe(false);
  });

  it("is commutative — order doesn't matter", () => {
    const a = { year_joined: "2018", year_departed: "2020" };
    const b = { year_joined: "2019", year_departed: "2021" };
    expect(areStintsOverlapping(a, b)).toBe(areStintsOverlapping(b, a));
  });
});

describe("computeMergedRange", () => {
  it("returns earliest joined and latest departed", () => {
    const result = computeMergedRange([
      { year_joined: "2018", year_departed: "2020" },
      { year_joined: "2019", year_departed: "2022" },
    ]);
    expect(result).toEqual({ year_joined: "2018", year_departed: "2022" });
  });

  it("preserves empty year_departed (ongoing stint)", () => {
    const result = computeMergedRange([
      { year_joined: "2018", year_departed: "2020" },
      { year_joined: "2020", year_departed: "" },
    ]);
    expect(result).toEqual({ year_joined: "2018", year_departed: "" });
  });

  it("handles a single stint", () => {
    const result = computeMergedRange([
      { year_joined: "2015", year_departed: "2018" },
    ]);
    expect(result).toEqual({ year_joined: "2015", year_departed: "2018" });
  });

  it("merges three overlapping stints", () => {
    const result = computeMergedRange([
      { year_joined: "2010", year_departed: "2013" },
      { year_joined: "2012", year_departed: "2015" },
      { year_joined: "2014", year_departed: "2018" },
    ]);
    expect(result).toEqual({ year_joined: "2010", year_departed: "2018" });
  });

  it("returns empty strings for empty input", () => {
    const result = computeMergedRange([]);
    expect(result).toEqual({ year_joined: "", year_departed: "" });
  });
});

describe("isFieldConflict", () => {
  it("returns true when both values are non-empty and different", () => {
    expect(isFieldConflict("1990-01-15", "1990-02-20")).toBe(true);
  });

  it("returns false when values match", () => {
    expect(isFieldConflict("1990-01-15", "1990-01-15")).toBe(false);
  });

  it("returns false when first value is empty", () => {
    expect(isFieldConflict("", "1990-01-15")).toBe(false);
  });

  it("returns false when second value is empty", () => {
    expect(isFieldConflict("1990-01-15", "")).toBe(false);
  });

  it("returns false when both values are empty", () => {
    expect(isFieldConflict("", "")).toBe(false);
  });
});
