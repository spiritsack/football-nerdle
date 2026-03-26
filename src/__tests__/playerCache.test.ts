import { describe, it, expect } from "vitest";
import { sortAndMergeTeams, isNationalTeam } from "../api/playerCache";
import type { FormerTeam } from "../types";

function team(id: string, name: string, joined: string, departed: string): FormerTeam {
  return { teamId: id, teamName: name, yearJoined: joined, yearDeparted: departed, badge: "" };
}

describe("sortAndMergeTeams", () => {
  it("sorts by yearJoined ascending", () => {
    const teams = [
      team("3", "Club C", "2015", "2018"),
      team("1", "Club A", "2005", "2010"),
      team("2", "Club B", "2010", "2015"),
    ];
    const result = sortAndMergeTeams(teams);
    expect(result.map((t) => t.teamName)).toEqual(["Club A", "Club B", "Club C"]);
  });

  it("uses yearDeparted as fallback when yearJoined is empty", () => {
    const teams = [
      team("2", "Club B", "2016", "2018"),
      team("1", "Club A", "", "2015"),
    ];
    const result = sortAndMergeTeams(teams);
    expect(result.map((t) => t.teamName)).toEqual(["Club A", "Club B"]);
  });

  it("puts departure-only entries before join entries in same year", () => {
    const teams = [
      team("2", "U19", "2015", "2016"),
      team("1", "U17", "", "2015"),
    ];
    const result = sortAndMergeTeams(teams);
    expect(result.map((t) => t.teamName)).toEqual(["U17", "U19"]);
  });

  it("sorts earlier departures first when join years match", () => {
    const teams = [
      team("2", "Sociedad", "2019", "2022"),
      team("1", "Willem II", "2019", "2019"),
    ];
    const result = sortAndMergeTeams(teams);
    expect(result.map((t) => t.teamName)).toEqual(["Willem II", "Sociedad"]);
  });

  it("puts entries with no year at the end", () => {
    const teams = [
      team("2", "Unknown", "", ""),
      team("1", "Club A", "2010", "2015"),
    ];
    const result = sortAndMergeTeams(teams);
    expect(result.map((t) => t.teamName)).toEqual(["Club A", "Unknown"]);
  });

  it("merges consecutive stints at the same club", () => {
    const teams = [
      team("1", "Barcelona", "2001", "2004"),
      team("1", "Barcelona", "2004", "2021"),
    ];
    const result = sortAndMergeTeams(teams);
    expect(result).toHaveLength(1);
    expect(result[0].yearJoined).toBe("2001");
    expect(result[0].yearDeparted).toBe("2021");
  });

  it("does not merge non-consecutive stints at the same club", () => {
    const teams = [
      team("1", "Man Utd", "2004", "2009"),
      team("2", "Real Madrid", "2009", "2013"),
      team("1", "Man Utd", "2013", "2015"),
    ];
    const result = sortAndMergeTeams(teams);
    expect(result).toHaveLength(3);
  });

  it("keeps empty departure when merging with current stint", () => {
    const teams = [
      team("1", "Club A", "2018", "2020"),
      team("1", "Club A", "2020", ""),
    ];
    const result = sortAndMergeTeams(teams);
    expect(result).toHaveLength(1);
    expect(result[0].yearDeparted).toBe("");
  });

  it("handles Isak-like career correctly", () => {
    const teams = [
      team("u17", "AIK U17", "", "2015"),
      team("u19", "AIK U19", "2015", "2016"),
      team("aik", "AIK", "2016", "2017"),
      team("bvb", "Dortmund", "2017", "2019"),
      team("wil", "Willem II", "2019", "2019"),
      team("rso", "Sociedad", "2019", "2022"),
      team("new", "Newcastle", "2022", "2025"),
      team("liv", "Liverpool", "2025", ""),
    ];
    const result = sortAndMergeTeams(teams);
    expect(result.map((t) => t.teamName)).toEqual([
      "AIK U17", "AIK U19", "AIK", "Dortmund", "Willem II", "Sociedad", "Newcastle", "Liverpool",
    ]);
  });
});

describe("isNationalTeam", () => {
  const countries = new Set(["argentina", "france", "england", "germany", "brazil", "spain", "mali", "italy"]);

  it("detects exact country match", () => {
    expect(isNationalTeam("Argentina", countries)).toBe(true);
    expect(isNationalTeam("France", countries)).toBe(true);
  });

  it("detects country with U-level suffix", () => {
    expect(isNationalTeam("Argentina U20", countries)).toBe(true);
    expect(isNationalTeam("France U23", countries)).toBe(true);
    expect(isNationalTeam("Germany U17", countries)).toBe(true);
  });

  it("detects country with B suffix", () => {
    expect(isNationalTeam("France B", countries)).toBe(true);
  });

  it("does not flag club names containing a country name", () => {
    expect(isNationalTeam("Inter Milan", countries)).toBe(false);
    expect(isNationalTeam("AC Milan", countries)).toBe(false);
    expect(isNationalTeam("Argentinos Juniors", countries)).toBe(false);
  });

  it("does not flag regular clubs", () => {
    expect(isNationalTeam("Barcelona", countries)).toBe(false);
    expect(isNationalTeam("Liverpool", countries)).toBe(false);
    expect(isNationalTeam("Bayern Munich", countries)).toBe(false);
  });

  it("handles case insensitivity", () => {
    expect(isNationalTeam("argentina", countries)).toBe(true);
    expect(isNationalTeam("FRANCE", countries)).toBe(true);
  });
});
