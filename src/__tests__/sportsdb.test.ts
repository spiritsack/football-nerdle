import { describe, it, expect } from "vitest";
import { didPlayTogether } from "../api/sportsdb";
import type { PlayerWithTeams } from "../types";

function makePlayer(name: string, teams: { id: string; name: string; joined: string; departed: string }[]): PlayerWithTeams {
  return {
    id: name,
    name,
    thumbnail: "",
    nationality: "",
    formerTeams: teams.map((t) => ({
      teamId: t.id,
      teamName: t.name,
      yearJoined: t.joined,
      yearDeparted: t.departed,
      badge: "",
    })),
  };
}

describe("didPlayTogether", () => {
  it("returns true when players overlapped at the same club", () => {
    const a = makePlayer("Player A", [{ id: "1", name: "Club X", joined: "2010", departed: "2015" }]);
    const b = makePlayer("Player B", [{ id: "1", name: "Club X", joined: "2012", departed: "2018" }]);
    const result = didPlayTogether(a, b);
    expect(result.together).toBe(true);
    expect(result.clubs).toEqual(["Club X"]);
  });

  it("returns false when players were at the same club but didn't overlap", () => {
    const a = makePlayer("Player A", [{ id: "1", name: "Club X", joined: "2010", departed: "2012" }]);
    const b = makePlayer("Player B", [{ id: "1", name: "Club X", joined: "2014", departed: "2018" }]);
    const result = didPlayTogether(a, b);
    expect(result.together).toBe(false);
  });

  it("returns false when players were at different clubs", () => {
    const a = makePlayer("Player A", [{ id: "1", name: "Club X", joined: "2010", departed: "2015" }]);
    const b = makePlayer("Player B", [{ id: "2", name: "Club Y", joined: "2010", departed: "2015" }]);
    const result = didPlayTogether(a, b);
    expect(result.together).toBe(false);
  });

  it("treats empty departure as still at club (current year)", () => {
    const a = makePlayer("Player A", [{ id: "1", name: "Club X", joined: "2020", departed: "" }]);
    const b = makePlayer("Player B", [{ id: "1", name: "Club X", joined: "2022", departed: "" }]);
    const result = didPlayTogether(a, b);
    expect(result.together).toBe(true);
  });

  it("accepts match when years can't be parsed", () => {
    const a = makePlayer("Player A", [{ id: "1", name: "Club X", joined: "", departed: "" }]);
    const b = makePlayer("Player B", [{ id: "1", name: "Club X", joined: "2020", departed: "" }]);
    const result = didPlayTogether(a, b);
    expect(result.together).toBe(true);
  });

  it("deduplicates shared club names", () => {
    const a = makePlayer("Player A", [
      { id: "1", name: "Club X", joined: "2010", departed: "2012" },
      { id: "1", name: "Club X", joined: "2014", departed: "2016" },
    ]);
    const b = makePlayer("Player B", [
      { id: "1", name: "Club X", joined: "2011", departed: "2015" },
    ]);
    const result = didPlayTogether(a, b);
    expect(result.together).toBe(true);
    expect(result.clubs).toEqual(["Club X"]);
  });

  it("finds multiple shared clubs", () => {
    const a = makePlayer("Player A", [
      { id: "1", name: "Club X", joined: "2010", departed: "2015" },
      { id: "2", name: "Club Y", joined: "2015", departed: "2020" },
    ]);
    const b = makePlayer("Player B", [
      { id: "1", name: "Club X", joined: "2012", departed: "2014" },
      { id: "2", name: "Club Y", joined: "2016", departed: "2018" },
    ]);
    const result = didPlayTogether(a, b);
    expect(result.together).toBe(true);
    expect(result.clubs).toEqual(["Club X", "Club Y"]);
  });

  it("returns false for boundary case where one leaves the year other joins", () => {
    const a = makePlayer("Player A", [{ id: "1", name: "Club X", joined: "2010", departed: "2014" }]);
    const b = makePlayer("Player B", [{ id: "1", name: "Club X", joined: "2014", departed: "2018" }]);
    // Year-level granularity: 2014 overlaps with 2014
    const result = didPlayTogether(a, b);
    expect(result.together).toBe(true);
  });
});
