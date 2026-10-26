import { describe, it, expect } from "vitest";
import {
  CREATED_CLUB_PREFIX,
  newCreatedClubId,
  rankSimilarClubs,
  similarClubSearchTerms,
  validateNewClubName,
} from "../pages/Admin/createClub";

describe("newCreatedClubId", () => {
  it("prefixes the uuid with admin_", () => {
    expect(newCreatedClubId("1234")).toBe("admin_1234");
    expect(CREATED_CLUB_PREFIX).toBe("admin_");
  });

  it("is unique per call and never looks like an imported id", () => {
    const ids = Array.from({ length: 50 }, () => newCreatedClubId());
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^admin_[0-9a-f-]{36}$/);
      expect(id).not.toMatch(/^tm_/);
      expect(id).not.toMatch(/^wd_/);
      expect(id).not.toMatch(/^\d+$/);
    }
  });
});

describe("validateNewClubName", () => {
  it("rejects an empty or whitespace-only name", () => {
    expect(validateNewClubName("")).toBe("Enter a club name.");
    expect(validateNewClubName("   ")).toBe("Enter a club name.");
  });

  it("rejects a name over 100 characters after trimming", () => {
    expect(validateNewClubName("a".repeat(101))).toBe("Club name must be 100 characters or fewer.");
    expect(validateNewClubName(`  ${"a".repeat(100)}  `)).toBeNull();
  });

  it("accepts a normal name", () => {
    expect(validateNewClubName("Al-Qadsiah")).toBeNull();
  });
});

describe("rankSimilarClubs", () => {
  const club = (id: string, name: string) => ({ id, name, badge: "" });

  it("marks AC Milan spellings as same, the youth team as similar, and drops Inter", () => {
    const ranked = rankSimilarClubs("AC Milan", [
      club("1", "AC Milan Primavera"),
      club("2", "Inter"),
      club("tm_5", "AC Milan"),
      club("133604", "A.C. Milan"),
    ]);
    expect(ranked.map((r) => [r.club.id, r.match])).toEqual([
      ["tm_5", "same"],
      ["133604", "same"],
      ["1", "similar"],
    ]);
  });

  it("rates AC Milan vs AC Milan as same", () => {
    expect(rankSimilarClubs("AC Milan", [club("a", "AC Milan")])[0]?.match).toBe("same");
  });

  it("ignores a trailing FC for same", () => {
    expect(rankSimilarClubs("Liverpool", [club("a", "Liverpool FC")])[0]?.match).toBe("same");
    expect(rankSimilarClubs("Liverpool", [club("a", "Liverpool F.C.")])[0]?.match).toBe("same");
  });

  it("rates names that only match without a leading prefix as similar", () => {
    expect(rankSimilarClubs("AC Milan", [club("tm_85168", "BK Milan FC")])[0]?.match).toBe("similar");
    expect(rankSimilarClubs("Nacional", [club("a", "Club Nacional")])[0]?.match).toBe("similar");
  });

  it("does not match other clubs that only share a word once the prefix is dropped", () => {
    expect(rankSimilarClubs("AC Milan", [club("a", "Inter Milan"), club("b", "Milan Futuro")])).toEqual([]);
  });

  it("matches Flamengo with CR Flamengo", () => {
    const [hit] = rankSimilarClubs("Flamengo", [club("a", "CR Flamengo")]);
    expect(["same", "similar"]).toContain(hit?.match);
  });

  it("ignores accents and case", () => {
    expect(rankSimilarClubs("nunez fc", [club("a", "Núñez FC")])[0]?.match).toBe("same");
    expect(rankSimilarClubs("Atletico Nunez", [club("a", "Atlético Núñez Juniors")])[0]?.match).toBe("similar");
  });

  it("matches whole words only", () => {
    expect(rankSimilarClubs("Nacional", [club("a", "Internacional")])).toEqual([]);
  });

  it("drops clubs with an empty name", () => {
    expect(rankSimilarClubs("Milan", [club("a", "")])).toEqual([]);
  });
});

describe("similarClubSearchTerms", () => {
  it("drops the club suffix and common words, longest first", () => {
    expect(similarClubSearchTerms("Manchester United FC")).toEqual(["manchester"]);
    expect(similarClubSearchTerms("Real Sociedad de Fútbol")).toEqual(["sociedad", "futbol"]);
  });

  it("returns at most 2 terms of at least 3 letters", () => {
    expect(similarClubSearchTerms("Al-Qadsiah Saudi Club Riyadh")).toEqual(["qadsiah", "riyadh"]);
    expect(similarClubSearchTerms("AC Milan")).toEqual(["milan"]);
  });

  it("falls back to common words when nothing else is left", () => {
    expect(similarClubSearchTerms("Real Club")).toEqual(["real", "club"]);
    expect(similarClubSearchTerms("Athletic Club")).toEqual(["athletic", "club"]);
  });

  it("falls back to the whole name when every word is short", () => {
    expect(similarClubSearchTerms("KV")).toEqual(["kv"]);
    expect(similarClubSearchTerms("  ")).toEqual([]);
  });
});
