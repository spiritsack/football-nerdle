import { describe, it, expect } from "vitest";
import {
  pickDefaultWinner,
  scoreColor,
  type PlayerCandidate,
  type ClubCandidate,
} from "../pages/Admin/DataCleanup/helpers";

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
